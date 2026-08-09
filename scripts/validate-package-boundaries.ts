/**
 * Enforces the package boundary rules and dependency graph mechanically, so
 * nothing can quietly couple two public packages or add an unapproved runtime
 * dependency.
 *
 * Run: pnpm run validate:boundaries
 */
import { existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import {
  DEVELOPMENT_ONLY_FOUNDATIONS,
  NON_ANALYSABLE_SPECIFIER,
  PRIVATE_FOUNDATIONS,
  PUBLIC_PACKAGES,
  type RuntimeSupport,
  REPO_ROOT,
  Violations,
  extractImports,
  listTypeScriptFiles,
  publicPackageDir,
  readManifest,
  repoRelative,
} from './lib/workspace.js';

const violations = new Violations();
const publicNames = Object.keys(PUBLIC_PACKAGES);

/**
 * Node built-in specifiers, with and without the `node:` prefix.
 *
 * Taken from `node:module`'s own `builtinModules` rather than a hand-written
 * list, which had drifted: `async_hooks`, `querystring`, `string_decoder`,
 * `http2` and `fs/promises` were all missing. Note the failure mode that
 * hid — an unlisted built-in **still errored**, because it fell through to
 * the "not an approved runtime dependency" branch, so the control failed
 * closed and only its message was wrong. Confirmed by injecting a bare
 * `import … from 'async_hooks'` into a universal package:
 *
 *     token-chunk imports "async_hooks", which is not an approved runtime dependency
 *
 * Anyone tempted to "fix" a future gap here by adding an early return should
 * know they would be converting a closed failure into an open one.
 *
 * `builtinModules` reflects the Node running this script; `sqlite` is added
 * explicitly because `node:sqlite` is only listed on versions that ship it,
 * and the boundary rule must hold regardless of the local runtime.
 */
const NODE_BUILTINS = new Set([...builtinModules, 'sqlite']);

function isNodeBuiltin(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  return NODE_BUILTINS.has(specifier);
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

/** Strips a subpath so `@scope/pkg/sub` resolves to `@scope/pkg`. */
function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

for (const [name, rules] of Object.entries(PUBLIC_PACKAGES)) {
  const dir = publicPackageDir(name);
  if (!existsSync(dir)) {
    violations.error(`packages/${name} is missing`);
    continue;
  }

  const manifest = readManifest(dir);

  // Rule 3 (inverted): public packages must not be private.
  if (manifest.private === true) {
    violations.error(`${name}: public package is marked "private": true`);
  }

  // Rule 5: only vec-cache may carry a required runtime dependency.
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (!rules.allowedRuntimeDependencies.includes(dependency)) {
      violations.error(
        `${name}: unapproved runtime dependency "${dependency}" (allowed: ${rules.allowedRuntimeDependencies.join(', ') || 'none'})`,
      );
    }
  }
  for (const dependency of Object.keys(manifest.peerDependencies ?? {})) {
    violations.error(`${name}: peer dependency "${dependency}" is not permitted in v1`);
  }

  // No workspace protocol may reach a consumer-facing dependency field.
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (range.startsWith('workspace:') || dependency.startsWith('@llm-kit/')) {
        violations.error(
          `${name}: ${field}.${dependency} references a workspace package; private foundations must be devDependencies and bundled`,
        );
      }
    }
  }

  const sourceFiles = listTypeScriptFiles(join(dir, 'src'));
  if (sourceFiles.length === 0) {
    violations.error(`${name}: src/ contains no TypeScript files`);
  }

  for (const file of sourceFiles) {
    for (const { specifier, line } of extractImports(file)) {
      if (isRelative(specifier)) continue;
      const location = `${repoRelative(file)}:${String(line)}`;

      // A specifier the parser could not resolve to a literal defeats every
      // rule below — none of them can classify what they cannot read. Reject
      // it on its own terms rather than letting it fall through to a
      // misleading "not an approved runtime dependency".
      if (specifier === NON_ANALYSABLE_SPECIFIER) {
        violations.error(
          `${location}: ${name} has a dynamic import whose specifier is not a literal, so boundary rules cannot be checked; use a literal specifier`,
        );
        continue;
      }

      const target = packageNameOf(specifier);

      // Rule 2: no public package may import another public package.
      if (publicNames.includes(target) && target !== name) {
        violations.error(
          `${location}: ${name} imports public package "${target}"; v1 forbids one public package from depending on another`,
        );
        continue;
      }

      // Rule 1: only approved private foundations.
      if (target.startsWith('@llm-kit/')) {
        if (DEVELOPMENT_ONLY_FOUNDATIONS.includes(target)) {
          violations.error(
            `${location}: ${name} imports development-only foundation "${target}" from src/`,
          );
        } else if (!rules.allowedFoundations.includes(target)) {
          violations.error(
            `${location}: ${name} imports foundation "${target}", which is not approved for this package`,
          );
        }
        continue;
      }

      // Rule 7: universal packages stay free of Node built-ins.
      if (isNodeBuiltin(specifier)) {
        if (rules.runtime === 'universal') {
          violations.error(
            `${location}: ${name} is browser-compatible but imports Node built-in "${specifier}"`,
          );
        }
        continue;
      }

      // Anything else must be an approved runtime dependency.
      if (!rules.allowedRuntimeDependencies.includes(target)) {
        violations.error(
          `${location}: ${name} imports "${specifier}", which is not an approved runtime dependency`,
        );
      }
    }
  }
}

// Rule 3: private foundations must actually be private.
for (const foundation of PRIVATE_FOUNDATIONS) {
  const dir = join(REPO_ROOT, 'internal', foundation.replace('@llm-kit/', ''));
  if (!existsSync(dir)) {
    violations.error(`internal/${foundation.replace('@llm-kit/', '')} is missing`);
    continue;
  }
  const manifest = readManifest(dir);
  if (manifest.private !== true) {
    violations.error(`${foundation}: private foundation must set "private": true`);
  }
  if (manifest.name !== foundation) {
    violations.error(`${foundation}: manifest name is "${manifest.name}"`);
  }
}

/**
 * A bundled foundation inherits the strictest runtime of any package that
 * bundles it, since its source is inlined into each consumer. Derived from
 * `PUBLIC_PACKAGES` rather than written out, so adding a foundation to a
 * universal package's `allowedFoundations` tightens this automatically
 * instead of requiring a second edit somebody has to remember.
 */
function foundationRuntime(foundation: string): RuntimeSupport {
  const specifier = `@llm-kit/${foundation}`;
  for (const rules of Object.values(PUBLIC_PACKAGES)) {
    if (rules.runtime === 'universal' && rules.allowedFoundations.includes(specifier)) {
      return 'universal';
    }
  }
  return 'node';
}

// Foundations must not depend on public packages either.
for (const foundation of ['tokenizer', 'model-registry']) {
  const files = listTypeScriptFiles(join(REPO_ROOT, 'internal', foundation, 'src'));
  for (const file of files) {
    for (const { specifier, line } of extractImports(file)) {
      if (isRelative(specifier)) continue;

      // Rule 7 again, for source that reaches a tarball. `@llm-kit/tokenizer`
      // ships inside `token-chunk` and `chat-fit`, `@llm-kit/model-registry`
      // inside `chat-fit` and `usage-tab` — so a Node built-in here breaks the
      // browser build of three universal packages. SECURITY.md already states
      // the principle ("source that reaches a tarball is governed by the rule
      // that governs published code") and this is it being applied.
      if (isNodeBuiltin(specifier)) {
        if (foundationRuntime(foundation) === 'universal') {
          violations.error(
            `${repoRelative(file)}:${String(line)}: foundation @llm-kit/${foundation} is bundled into browser-compatible packages but imports Node built-in "${specifier}"`,
          );
        }
        continue;
      }
      // Same reasoning as the package loop above. Without this branch the
      // sentinel matches none of the checks below and passes silently.
      if (specifier === NON_ANALYSABLE_SPECIFIER) {
        violations.error(
          `${repoRelative(file)}:${String(line)}: foundation @llm-kit/${foundation} has a dynamic import whose specifier is not a literal, so boundary rules cannot be checked; use a literal specifier`,
        );
        continue;
      }
      const target = packageNameOf(specifier);
      if (publicNames.includes(target)) {
        violations.error(
          `${repoRelative(file)}:${String(line)}: foundation @llm-kit/${foundation} imports public package "${target}"`,
        );
        continue;
      }
      if (target.startsWith('@llm-kit/')) {
        if (DEVELOPMENT_ONLY_FOUNDATIONS.includes(target)) {
          violations.error(
            `${repoRelative(file)}:${String(line)}: foundation @llm-kit/${foundation} imports development-only "${target}" from src/`,
          );
        }
        continue;
      }

      // The terminal branch the package loop has always had, and this one did
      // not. A bundled foundation has no approved runtime dependencies at all:
      // its source is inlined into every consumer, and `internal/build-config`
      // sets `external: []`, so a third-party import here is *bundled into*
      // `dist/` rather than left as an import. It would therefore ship inside
      // `token-chunk`, `chat-fit` and `usage-tab` with nothing in their
      // `dependencies`, invisible to `pnpm audit --prod`, with no license
      // attribution, and contradicting SECURITY.md's "ships five of six with
      // zero runtime dependencies" — while every release gate stayed green.
      violations.error(
        `${repoRelative(file)}:${String(line)}: foundation @llm-kit/${foundation} imports "${specifier}"; bundled foundations must have no runtime dependencies — it would be inlined into every package that bundles this foundation with nothing declared in that package's dependencies`,
      );
    }
  }

  // The manifest half of the same rule: an import only typechecks if the
  // foundation declares the package, so checking the import graph without
  // checking the manifest leaves the two halves of one policy in different
  // places. Nothing checked these fields before — `validate-package-metadata.ts`
  // iterates `PUBLIC_PACKAGES` only.
  const manifest = readManifest(join(REPO_ROOT, 'internal', foundation));
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      violations.error(
        `@llm-kit/${foundation}: ${field}.${dependency} is not permitted — a bundled foundation's imports are inlined into every consumer, so it must carry no runtime dependencies`,
      );
    }
  }
}

violations.report('package boundaries');
