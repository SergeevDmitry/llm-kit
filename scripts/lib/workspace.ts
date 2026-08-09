import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export type RuntimeSupport = 'universal' | 'node';

export interface PublicPackageRules {
  /**
   * `universal` packages must import no Node built-in from `src/` so the
   * default entry point works in browsers and edge runtimes.
   */
  readonly runtime: RuntimeSupport;
  /** Private workspace foundations this package is allowed to bundle. */
  readonly allowedFoundations: readonly string[];
  /** Runtime dependencies allowed in `dependencies`. */
  readonly allowedRuntimeDependencies: readonly string[];
}

/**
 * Machine-readable form of the package boundary rules and dependency graph.
 * These are expensive to reverse once other code depends on them, so changing
 * an entry here needs agreement before the code lands, not after.
 */
export const PUBLIC_PACKAGES: Readonly<Record<string, PublicPackageRules>> = {
  'mend-json': {
    runtime: 'universal',
    allowedFoundations: [],
    allowedRuntimeDependencies: [],
  },
  'token-chunk': {
    runtime: 'universal',
    allowedFoundations: ['@llm-kit/tokenizer'],
    allowedRuntimeDependencies: [],
  },
  'chat-fit': {
    runtime: 'universal',
    // The model registry is permitted only for optional context-window
    // helpers; the core fitting API must work from an explicit budget.
    allowedFoundations: ['@llm-kit/tokenizer', '@llm-kit/model-registry'],
    allowedRuntimeDependencies: [],
  },
  'llm-price': {
    runtime: 'universal',
    allowedFoundations: ['@llm-kit/model-registry'],
    allowedRuntimeDependencies: [],
  },
  'llm-backoff': {
    runtime: 'universal',
    allowedFoundations: [],
    allowedRuntimeDependencies: [],
  },
  'vec-cache': {
    runtime: 'node',
    allowedFoundations: [],
    allowedRuntimeDependencies: ['better-sqlite3'],
  },
};

export const PRIVATE_FOUNDATIONS = [
  '@llm-kit/tokenizer',
  '@llm-kit/model-registry',
  '@llm-kit/test-utils',
  '@llm-kit/build-config',
] as const;

/** Foundations that exist for development only and must never reach `src/`. */
export const DEVELOPMENT_ONLY_FOUNDATIONS = ['@llm-kit/test-utils', '@llm-kit/build-config'];

export interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;
  type?: string;
  description?: string;
  keywords?: string[];
  license?: string;
  author?: string;
  homepage?: string;
  repository?: { type?: string; url?: string; directory?: string };
  bugs?: { url?: string };
  engines?: Record<string, string>;
  main?: string;
  module?: string;
  types?: string;
  exports?: unknown;
  files?: string[];
  sideEffects?: boolean | string[];
  publishConfig?: Record<string, unknown>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export function readManifest(packageDir: string): PackageManifest {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as PackageManifest;
}

export function publicPackageDir(name: string): string {
  return join(REPO_ROOT, 'packages', name);
}

/** Recursively lists `.ts` files under a directory; returns [] if missing. */
export function listTypeScriptFiles(directory: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort()) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      // Loop rather than `push(...nested)`. The argument count here is bounded
      // by the repository's own file count, so spreading would be harmless,
      // but this file is where the repository's no-dynamic-spread rule is
      // enforced elsewhere, and an unobserved exception here undercuts it.
      for (const nested of listTypeScriptFiles(full)) files.push(nested);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

export interface ImportRef {
  readonly specifier: string;
  readonly file: string;
  readonly line: number;
}

/**
 * Sentinel specifier for a dynamic `import()` / `require()` call whose
 * argument is not a compile-time-known string (a template literal with
 * substitutions, a variable, a function call, ...). A line-oriented regex
 * scanner silently ignores these, so a specifier built by concatenation or
 * held in a variable would be invisible to every boundary rule. Every rule
 * in `validate-package-boundaries.ts` runs a `specifier`
 * through `packageNameOf` and, failing every allow-list, falls through to
 * "which is not an approved runtime dependency" — so returning this text as
 * the specifier turns a silent gap into a reported violation without the
 * caller needing to know about the non-literal case specially.
 */
export const NON_ANALYSABLE_SPECIFIER = 'dynamic import specifier is not statically analysable';

/** True for `"x"`, `'x'`, and `` `x` `` (a template literal with no `${...}` substitutions). */
function literalSpecifierText(expression: ts.Expression): string | undefined {
  return ts.isStringLiteralLike(expression) ? expression.text : undefined;
}

/**
 * Extracts module specifiers from a TypeScript source file by parsing it
 * rather than scanning it line by line with regexes, so that:
 *
 * - a specifier is found regardless of line breaks inside the call
 *   (`import(\n  'node:http'\n)`);
 * - `export ... from '...'` and `export * from '...'` re-exports are seen,
 *   since a re-export carries the same coupling as an import;
 * - a specifier inside a comment or an unrelated string literal is never
 *   mistaken for an import;
 * - a dynamic `import()`/`require()` whose argument is not a literal string
 *   is reported as `NON_ANALYSABLE_SPECIFIER` instead of silently skipped —
 *   a non-literal specifier is itself a gap worth flagging, not just a
 *   fixture to ignore for coverage.
 *
 * `import type { ... }` and `export type { ... }` specifiers ARE included,
 * deliberately not exempted, even though `verbatimModuleSyntax` guarantees
 * they are erased before bundling. Two reasons:
 *
 * 1. Erasure only protects the runtime bundle. A type-only import from a
 *    development-only foundation still walks the source dependency graph
 *    and can leak into bundled type declarations if a public export's type
 *    references it — a source-level risk unrelated to what tsup emits.
 * 2. `ImportRef` carries only a `specifier`, and the caller applies one rule
 *    per specifier with no "value import only" carve-out. There is no clean
 *    way to treat a type-only Node built-in differently from a type-only
 *    unapproved foundation without a caller change, so this function errs
 *    toward flagging both.
 *
 * Net effect: a type-only import of a Node built-in in a universal
 * package's `src/` (e.g. `import type { IncomingMessage } from 'node:http'`)
 * is reported as a violation even though it is erased and runtime-safe. No
 * such import exists in this repository today, so this is a documented
 * decision about future code, not a live finding. See `workspace.test.ts`
 * for the fixture that pins this behaviour.
 */
export function extractImports(file: string): ImportRef[] {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const refs: ImportRef[] = [];

  function push(specifier: string, node: ts.Node): void {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    refs.push({ specifier, file, line: line + 1 });
  }

  /** Handles the single-argument call form shared by `import(...)` and `require(...)`. */
  function pushCallArgument(call: ts.CallExpression): void {
    const [arg] = call.arguments;
    if (arg === undefined) return;
    const text = literalSpecifierText(arg);
    push(text ?? NON_ANALYSABLE_SPECIFIER, call);
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const text = literalSpecifierText(node.moduleSpecifier);
      push(text ?? NON_ANALYSABLE_SPECIFIER, node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      const text = literalSpecifierText(node.moduleSpecifier);
      push(text ?? NON_ANALYSABLE_SPECIFIER, node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const text = literalSpecifierText(node.moduleReference.expression);
      push(text ?? NON_ANALYSABLE_SPECIFIER, node);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) {
        pushCallArgument(node);
      } else if (ts.isIdentifier(callee) && callee.text === 'require') {
        pushCallArgument(node);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return refs;
}

export function repoRelative(file: string): string {
  return relative(REPO_ROOT, file);
}

export class Violations {
  private readonly errors: string[] = [];
  private readonly warnings: string[] = [];

  error(message: string): void {
    this.errors.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Prints results and exits non-zero when any error was recorded.
   *
   * Sets `process.exitCode` rather than calling `process.exit(1)`. Node's
   * stdout/stderr writes are synchronous to files and TTYs but asynchronous
   * to pipes, which is what a CI runner provides, so exiting immediately
   * after `console.error` can truncate a long violation list. Letting the
   * process end naturally flushes first.
   */
  report(label: string): void {
    for (const warning of this.warnings) {
      console.warn(`  warn  ${warning}`);
    }
    for (const error of this.errors) {
      console.error(`  FAIL  ${error}`);
    }
    if (this.errors.length > 0) {
      console.error(
        `\n${label}: ${String(this.errors.length)} violation(s), ${String(this.warnings.length)} warning(s)`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(`${label}: OK (${String(this.warnings.length)} warning(s))`);
  }
}

/**
 * Network globals as they appear in a *built bundle*, for
 * `validate-published-artifacts.ts`'s belt-and-braces scan of packed output
 * (SECURITY.md, "makes no network calls").
 *
 * Three alternatives rather than one, because the obvious single pattern
 * misses a real case. Excluding method calls with a `(?<![.\w$])` lookbehind
 * — so `client.fetch(x)` does not match — also excludes `globalThis.fetch(`,
 * `window.fetch(` and `self.fetch(`, which are real network calls and the
 * form a bundler may emit when it rewrites a bare `fetch` for scope safety.
 * Prefixing that lookbehind with an optional `globalThis\.` group does not
 * fix it: once the group matches, the lookbehind sits after a `.` and fails.
 * The qualified forms need their own alternative, which is what this is.
 *
 * Deliberately not exhaustive: `const f = globalThis.fetch; f(url)` is out of
 * reach for any regex and is left to the ESLint rule over source, which sees
 * the reference rather than the call.
 */
const NETWORK_GLOBAL_PATTERN =
  /\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|\b(?:globalThis|window|self|global)\s*\.\s*fetch\s*\(|(?<![.\w$])fetch\s*\(/;

/** Returns the offending snippet when `contents` references a network global, else `undefined`. */
export function findNetworkGlobal(contents: string): string | undefined {
  return NETWORK_GLOBAL_PATTERN.exec(contents)?.[0]?.trim();
}
