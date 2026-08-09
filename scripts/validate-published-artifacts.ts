/**
 * Packs every public package, installs the tarball into a clean throwaway
 * project, and proves the published artifact actually works.
 *
 * Covers the release gate:
 *  - the tarball contains only the declared files;
 *  - no `@llm-kit/*` import survives in shipped JavaScript or declarations;
 *  - no `workspace:` protocol reaches a consumer-facing dependency field;
 *  - ESM `import` works;
 *  - CommonJS `require` works where advertised;
 *  - declarations resolve under a strict consumer tsconfig.
 *
 * Run: pnpm run validate:artifacts  [-- <package> ...]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PUBLIC_PACKAGES,
  REPO_ROOT,
  Violations,
  findNetworkGlobal,
  publicPackageDir,
} from './lib/workspace.js';

const violations = new Violations();

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = requested.length > 0 ? requested : Object.keys(PUBLIC_PACKAGES);

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_yes: 'true' },
  });
}

const workRoot = mkdtempSync(join(tmpdir(), 'llm-kit-artifacts-'));

try {
  for (const name of targets) {
    const rules = PUBLIC_PACKAGES[name];
    if (rules === undefined) {
      violations.error(`unknown package "${name}"`);
      continue;
    }
    const packageDir = publicPackageDir(name);
    if (!existsSync(join(packageDir, 'dist'))) {
      violations.error(`${name}: dist/ is missing — run "pnpm run build" first`);
      continue;
    }

    console.log(`\n[${name}] packing…`);
    const packOutput = run('pnpm', ['pack', '--pack-destination', workRoot], packageDir).trim();
    const tarball = packOutput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'))
      .pop();
    if (tarball === undefined) {
      violations.error(`${name}: could not determine tarball name from pnpm pack output`);
      continue;
    }
    const tarballPath = tarball.startsWith('/') ? tarball : join(workRoot, tarball);

    // --- tarball contents -------------------------------------------------
    const listing = run('tar', ['-tzf', tarballPath], workRoot)
      .split('\n')
      .map((line) => line.replace(/^package\//, '').trim())
      .filter((line) => line.length > 0);

    for (const required of ['README.md', 'LICENSE', 'package.json', 'dist/index.js']) {
      if (!listing.includes(required)) {
        violations.error(`${name}: tarball is missing ${required}`);
      }
    }
    for (const entry of listing) {
      const allowed =
        entry === 'README.md' ||
        entry === 'LICENSE' ||
        entry === 'package.json' ||
        entry.startsWith('dist/');
      if (!allowed) {
        violations.error(`${name}: tarball contains unexpected entry "${entry}"`);
      }
    }
    for (const entry of listing) {
      if (/\.(test|bench|spec)\./.test(entry) || entry.includes('__fixtures__')) {
        violations.error(`${name}: tarball ships development file "${entry}"`);
      }
    }

    // --- extract and inspect ---------------------------------------------
    const extractDir = join(workRoot, `${name}-extract`);
    mkdirSync(extractDir, { recursive: true });
    run('tar', ['-xzf', tarballPath, '-C', extractDir], workRoot);
    const packageRoot = join(extractDir, 'package');

    const packedManifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as Record<string, Record<string, string> | undefined>;

    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dependency, range] of Object.entries(packedManifest[field] ?? {})) {
        if (String(range).startsWith('workspace:')) {
          violations.error(
            `${name}: packed ${field}.${dependency} still uses the workspace protocol`,
          );
        }
        if (dependency.startsWith('@llm-kit/')) {
          violations.error(
            `${name}: packed ${field} references unpublished workspace package "${dependency}"`,
          );
        }
        if (!rules.allowedRuntimeDependencies.includes(dependency)) {
          violations.error(`${name}: packed ${field} contains unapproved "${dependency}"`);
        }
      }
    }

    // Shipped code must not import a private foundation by name.
    for (const artifact of listing.filter(
      (entry) => entry.startsWith('dist/') && !entry.endsWith('.map'),
    )) {
      const contents = readFileSync(join(packageRoot, artifact), 'utf8');
      const match = /(?:from\s*['"]|require\(\s*['"]|import\(\s*['"])(@llm-kit\/[^'"]+)['"]/.exec(
        contents,
      );
      if (match !== null) {
        violations.error(
          `${name}: ${artifact} imports private foundation "${String(match[1])}" instead of bundling it`,
        );
      }
      if (/\bfrom\s*['"]workspace:/.test(contents)) {
        violations.error(`${name}: ${artifact} contains a workspace: specifier`);
      }

      // Declarations must be fully self-contained. tsup's dts step will
      // happily emit `from './types.js'` pointing into a bundled foundation's
      // *source* layout — files that do not exist in the tarball. The clean
      // consumer typecheck below catches it too, but only as an opaque tsc
      // failure, so name the real problem here.
      if (artifact.endsWith('.d.ts') || artifact.endsWith('.d.cts')) {
        const relativeImport = /(?:from|import)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/.exec(contents);
        if (relativeImport !== null) {
          violations.error(
            `${name}: ${artifact} imports "${String(relativeImport[1])}", which does not exist in the tarball — ` +
              `declarations must be fully inlined (see internal/build-config dts.compilerOptions.paths)`,
          );
        }
      }

      // "Makes no network calls" (SECURITY.md), checked on the artifact the
      // guarantee is actually about. ESLint enforces this on every source tree
      // that reaches a tarball, but ESLint reads source; this reads the packed
      // bundle, so it also covers anything a build step could introduce. The
      // one package that legitimately calls `fetch` is allowlisted, exactly as
      // in eslint.config.js.
      if (name !== 'llm-backoff' && (artifact.endsWith('.js') || artifact.endsWith('.cjs'))) {
        const network = findNetworkGlobal(contents);
        if (network !== undefined) {
          violations.error(
            `${name}: ${artifact} references "${network}" — packages must make no network calls (SECURITY.md)`,
          );
        }
      }
    }

    // --- clean consumer project ------------------------------------------
    const consumerDir = join(workRoot, `${name}-consumer`);
    mkdirSync(consumerDir, { recursive: true });
    writeFileSync(
      join(consumerDir, 'package.json'),
      `${JSON.stringify(
        {
          name: `${name}-consumer`,
          private: true,
          version: '1.0.0',
          type: 'module',
          dependencies: { [name]: `file:${tarballPath}` },
        },
        null,
        2,
      )}\n`,
    );

    console.log(`[${name}] installing tarball into a clean project…`);
    try {
      run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], consumerDir);
    } catch (error) {
      violations.error(`${name}: clean install of the tarball failed: ${String(error)}`);
      continue;
    }

    // ESM import
    writeFileSync(
      join(consumerDir, 'smoke.mjs'),
      [
        `import * as api from '${name}';`,
        `const names = Object.keys(api).filter((key) => key !== 'default');`,
        `if (names.length === 0) { throw new Error('${name} exported nothing over ESM'); }`,
        `console.log('esm-ok', names.length);`,
        '',
      ].join('\n'),
    );
    try {
      const output = run('node', ['smoke.mjs'], consumerDir);
      if (!output.includes('esm-ok')) {
        violations.error(`${name}: ESM smoke test produced no confirmation`);
      }
    } catch (error) {
      violations.error(`${name}: ESM import failed: ${String(error)}`);
    }

    // CommonJS require
    writeFileSync(
      join(consumerDir, 'smoke.cjs'),
      [
        `const api = require('${name}');`,
        `const names = Object.keys(api).filter((key) => key !== 'default');`,
        `if (names.length === 0) { throw new Error('${name} exported nothing over CommonJS'); }`,
        `console.log('cjs-ok', names.length);`,
        '',
      ].join('\n'),
    );
    try {
      const output = run('node', ['smoke.cjs'], consumerDir);
      if (!output.includes('cjs-ok')) {
        violations.error(`${name}: CommonJS smoke test produced no confirmation`);
      }
    } catch (error) {
      violations.error(`${name}: CommonJS require failed: ${String(error)}`);
    }

    // Declarations resolve under a strict consumer tsconfig.
    writeFileSync(
      join(consumerDir, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
          },
          include: ['consumer.ts'],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(consumerDir, 'consumer.ts'),
      [`import * as api from '${name}';`, `export const surface: unknown = api;`, ''].join('\n'),
    );
    try {
      run(
        'node',
        [join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
        consumerDir,
      );
    } catch (error) {
      const detail =
        error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
      violations.error(`${name}: declarations failed to typecheck in a clean consumer:\n${detail}`);
    }

    console.log(`[${name}] ok`);
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}

violations.report('published artifacts');
