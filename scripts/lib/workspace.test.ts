/**
 * Tests for `extractImports`.
 *
 * The previous implementation ran four independent regexes over each line
 * of a file in isolation. That has two failure shapes, both exercised
 * below: it misses specifiers a `require`/`import()` call can legally
 * spread across multiple lines or hold in a variable (false negative —
 * silently invisible to every boundary rule), and it fires on text inside a
 * comment or an unrelated string literal that merely looks like an import
 * (false positive). `OLD_extractImportsForComparison` below is a faithful
 * copy of the old function, kept only so the tests can prove — not just
 * assert — which fixtures it got wrong.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findNetworkGlobal,
  extractImports,
  NON_ANALYSABLE_SPECIFIER,
  type ImportRef,
} from './workspace.js';

// --- verbatim copy of the pre-fix implementation, for comparison only ---
const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
];

function OLD_extractImportsForComparison(source: string, file: string): ImportRef[] {
  const lines = source.split('\n');
  const refs: ImportRef[] = [];
  lines.forEach((lineText, index) => {
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(lineText)) !== null) {
        const specifier = match[1];
        if (specifier !== undefined) {
          refs.push({ specifier, file, line: index + 1 });
        }
      }
    }
  });
  return refs;
}
// --- end verbatim copy ---

let dir: string | undefined;

function fixture(name: string, source: string): string {
  dir ??= mkdtempSync(join(tmpdir(), 'llm-kit-workspace-test-'));
  const file = join(dir, name);
  writeFileSync(file, source, 'utf8');
  return file;
}

function specifiers(refs: ImportRef[]): string[] {
  return refs.map((ref) => ref.specifier);
}

afterEach(() => {
  if (dir !== undefined) {
    rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe('extractImports — literal specifiers the old scanner also found', () => {
  it('finds a named import', () => {
    const file = fixture('named.ts', `import { a } from 'pkg-a';\n`);
    expect(extractImports(file)).toEqual([{ specifier: 'pkg-a', file, line: 1 }]);
  });

  it('finds a namespace import', () => {
    const file = fixture('ns.ts', `import * as ns from 'pkg-b';\n`);
    expect(specifiers(extractImports(file))).toEqual(['pkg-b']);
  });

  it('finds a bare side-effect import', () => {
    const file = fixture('bare.ts', `import 'pkg-c';\n`);
    expect(specifiers(extractImports(file))).toEqual(['pkg-c']);
  });

  it('finds a literal require()', () => {
    const file = fixture('require.ts', `const x = require('node:fs');\n`);
    expect(specifiers(extractImports(file))).toEqual(['node:fs']);
  });
});

describe('extractImports — cases the old scanner missed', () => {
  it('finds a dynamic import() whose argument spans multiple lines', () => {
    const source = `const mod = await import(\n  'node:http'\n);\n`;
    const file = fixture('multiline-dynamic-import.ts', source);

    const fresh = extractImports(file);
    expect(specifiers(fresh)).toEqual(['node:http']);
    // The call starts on line 1 ("const mod = await import(").
    expect(fresh[0]?.line).toBe(1);

    // Prove the old scanner actually missed it: each of its four patterns
    // requires the specifier's quote to appear on the same line as the
    // keyword it looks for.
    const old = OLD_extractImportsForComparison(source, file);
    expect(old).toEqual([]);
  });

  it('finds "export { x } from"', () => {
    const source = `export { x } from 'pkg-d';\n`;
    const file = fixture('export-from.ts', source);
    expect(specifiers(extractImports(file))).toEqual(['pkg-d']);
    // The old scanner's `from\s*['"]...['"]` pattern happens to also catch
    // this one (it does not care what precedes "from"), so this fixture is
    // here for completeness/regression coverage, not as a gap proof.
    expect(specifiers(OLD_extractImportsForComparison(source, file))).toEqual(['pkg-d']);
  });

  it('finds "export * from"', () => {
    const source = `export * from 'pkg-e';\n`;
    const file = fixture('export-star.ts', source);
    expect(specifiers(extractImports(file))).toEqual(['pkg-e']);
  });

  it('finds "export * as ns from"', () => {
    const source = `export * as ns from 'pkg-f';\n`;
    const file = fixture('export-star-as.ts', source);
    expect(specifiers(extractImports(file))).toEqual(['pkg-f']);
  });

  it('does not mistake a specifier-shaped string inside a line comment for an import', () => {
    const source = [
      `// import { a } from 'not-a-real-import';`,
      `import { b } from 'pkg-g';`,
      '',
    ].join('\n');
    const file = fixture('comment.ts', source);
    expect(specifiers(extractImports(file))).toEqual(['pkg-g']);

    // Prove the old scanner is a false positive here: it has no concept of
    // a comment, so it reports the commented-out specifier too.
    const old = OLD_extractImportsForComparison(source, file);
    expect(specifiers(old)).toContain('not-a-real-import');
  });

  it('does not mistake an import-shaped string literal for an import', () => {
    const source = `const help = "run: import { a } from 'pkg-h'";\n`;
    const file = fixture('string-literal.ts', source);
    expect(extractImports(file)).toEqual([]);

    // The old scanner has no notion of "inside a string literal" either.
    const old = OLD_extractImportsForComparison(source, file);
    expect(specifiers(old)).toContain('pkg-h');
  });

  it('resolves a no-substitution template literal specifier as a literal', () => {
    // A template literal with no `${...}` is compile-time-known, exactly
    // like a string literal (`ts.isStringLiteralLike` treats them alike) —
    // this package's deliberate choice for what counts as "literal".
    const source = 'const mod = await import(`node:http`);\n';
    const file = fixture('template-no-sub.ts', source);
    expect(specifiers(extractImports(file))).toEqual(['node:http']);
  });

  it('flags a template literal WITH a substitution as non-analysable, not silently skipped', () => {
    const source = ['const base = "node";', 'const mod = await import(`${base}:http`);', ''].join(
      '\n',
    );
    const file = fixture('template-with-sub.ts', source);
    const refs = extractImports(file);
    expect(specifiers(refs)).toEqual([NON_ANALYSABLE_SPECIFIER]);
    expect(refs[0]?.line).toBe(2);

    // The old scanner required a literal quote right after `import(`, so a
    // template literal never matched at all — silently invisible.
    const old = OLD_extractImportsForComparison(source, file);
    expect(old).toEqual([]);
  });

  it('flags a specifier held in a variable as non-analysable, not silently skipped', () => {
    const source = ["const modName = 'node:http';", 'const mod = await import(modName);', ''].join(
      '\n',
    );
    const file = fixture('variable-specifier.ts', source);
    const refs = extractImports(file);
    expect(specifiers(refs)).toEqual([NON_ANALYSABLE_SPECIFIER]);
    expect(refs[0]?.line).toBe(2);

    const old = OLD_extractImportsForComparison(source, file);
    expect(old).toEqual([]);
  });

  it('flags a non-literal require() argument as non-analysable', () => {
    const source = ['const modName = "node:fs";', 'const fs = require(modName);', ''].join('\n');
    const file = fixture('require-variable.ts', source);
    expect(specifiers(extractImports(file))).toEqual([NON_ANALYSABLE_SPECIFIER]);
  });

  it('finds "import x = require(...)" (ImportEqualsDeclaration)', () => {
    const source = "import fs = require('node:fs');\n";
    const file = fixture('import-equals.ts', source);
    expect(specifiers(extractImports(file))).toEqual(['node:fs']);
  });
});

describe('extractImports — type-only imports (documented decision)', () => {
  it('includes a type-only import specifier, same as a value import', () => {
    // Deliberate: see the doc comment on `extractImports`. Even though
    // `import type` is erased before bundling under this repo's
    // `verbatimModuleSyntax`, the shared caller (`validate-package-boundaries.ts`)
    // has no way to treat a type-only specifier differently from a value
    // one, and erasure alone does not rule out a declaration-bundling leak
    // for an unapproved foundation. So a type-only import of a Node
    // built-in in a universal package IS reported here — an intentional,
    // documented over-inclusion, not an oversight.
    const file = fixture(
      'type-only-import.ts',
      `import type { IncomingMessage } from 'node:http';\n`,
    );
    expect(specifiers(extractImports(file))).toEqual(['node:http']);
  });

  it('includes a type-only re-export specifier', () => {
    const file = fixture('type-only-export.ts', `export type { Foo } from 'pkg-i';\n`);
    expect(specifiers(extractImports(file))).toEqual(['pkg-i']);
  });
});

/**
 * `findNetworkGlobal` backs `validate-published-artifacts.ts`'s scan of packed
 * bundles, which `SECURITY.md` presents as the layer covering what ESLint
 * cannot ("a build step could not introduce one either").
 *
 * `globalThis.fetch(` is the form a bundler is most likely to emit when it
 * rewrites a bare `fetch` for scope safety, and a naive lookbehind still
 * misses it: prefixing the lookbehind with an optional `globalThis\.` group
 * leaves it sitting after a `.`, where it still fails. Hence the separate
 * alternative, and hence this table.
 */
describe('findNetworkGlobal', () => {
  const CAUGHT = [
    'fetch(url)',
    'await fetch (url)',
    'globalThis.fetch(url)',
    'window.fetch(url)',
    'self.fetch(u)',
    'global . fetch (u)',
    'new WebSocket(u)',
    'new XMLHttpRequest()',
    'new EventSource(u)',
    'navigator.sendBeacon(u)',
  ];
  const ALLOWED = [
    'obj.fetch(url)',
    'client.fetch(x)',
    'prefetch(url)',
    'refetch(x)',
    'myFetch(url)',
    'const fetchSize = 3',
    '"fetching data"',
  ];

  it.each(CAUGHT)('flags %j', (source) => {
    expect(findNetworkGlobal(source)).toBeDefined();
  });

  it.each(ALLOWED)('allows %j', (source) => {
    expect(findNetworkGlobal(source)).toBeUndefined();
  });

  it('is documented as not reaching an assign-then-call reference', () => {
    // Out of reach for any regex; the ESLint rule over source sees the
    // reference itself. Pinned so the limitation stays deliberate rather than
    // being mistaken for coverage.
    expect(findNetworkGlobal('const f = globalThis.fetch; f(url)')).toBeUndefined();
  });
});
