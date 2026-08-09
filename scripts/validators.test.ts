/**
 * Behaviour tests for the validators that constitute the release gate.
 *
 * Every one of them is a control whose failure mode is a silent pass, which
 * is the failure mode a test catches and code review does not. Reading the
 * rule proves it exists; only running it against a violation proves it works.
 *
 * Each case therefore asserts a negative: given source that breaks the rule,
 * the validator must exit non-zero and say why. A validator that has only
 * ever been observed passing has not been observed at all.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO_ROOT } from './lib/workspace.js';

/** Runs a validator against the real repository, returning its exit code and output. */
function runValidator(
  script: string,
  args: readonly string[] = [],
): { status: number; output: string } {
  // `spawnSync`, not `execFileSync`: validators write violations and warnings
  // through `console.error`/`console.warn` (stderr) and their OK line through
  // `console.log` (stdout). `execFileSync` returns stdout only on success, so
  // a warning-assertion would silently never see its subject.
  const result = spawnSync('pnpm', ['exec', 'tsx', join('scripts', script), ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * Files written into the real tree, then removed. The validators walk the
 * repository itself rather than an injectable root, so a violation has to be
 * planted where they look. Every path is registered for cleanup before it is
 * written.
 */
const planted: string[] = [];

function plant(relativePath: string, contents: string): void {
  const full = join(REPO_ROOT, relativePath);
  planted.push(full);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents);
}

afterEach(() => {
  while (planted.length > 0) {
    const full = planted.pop();
    if (full !== undefined) rmSync(full, { force: true });
  }
});

describe('validate-package-boundaries', () => {
  it('passes on the unmodified repository', () => {
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toContain('package boundaries: OK');
    expect(status).toBe(0);
  });

  it('rejects a third-party import in a public package', () => {
    plant(
      'packages/token-chunk/src/__validator_probe.ts',
      `import { stringify } from 'fast-check';\nexport const probe = stringify;\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/not an approved runtime dependency/);
    expect(status).not.toBe(0);
  });

  it('rejects a third-party import in bundled foundation source', () => {
    // This must fail the same way the identical import in a public package
    // does one directory over: foundation source is inlined into every
    // published package that bundles it, so it would have shipped undeclared.
    plant(
      'internal/tokenizer/src/__validator_probe.ts',
      `import { stringify } from 'fast-check';\nexport const probe = stringify;\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/bundled foundations must have no runtime dependencies/);
    expect(status).not.toBe(0);
  });

  it('rejects a Node built-in in bundled foundation source', () => {
    plant(
      'internal/model-registry/src/__validator_probe.ts',
      `import { createHash } from 'node:crypto';\nexport const probe = createHash;\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/bundled into browser-compatible packages but imports Node built-in/);
    expect(status).not.toBe(0);
  });

  it('rejects a Node built-in in a universal public package', () => {
    plant(
      'packages/mend-json/src/__validator_probe.ts',
      `import { createHash } from 'node:crypto';\nexport const probe = createHash;\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/browser-compatible but imports Node built-in/);
    expect(status).not.toBe(0);
  });

  it('rejects a public-to-public import', () => {
    plant(
      'packages/token-chunk/src/__validator_probe.ts',
      `export { calculateCost } from 'llm-price';\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/imports public package/);
    expect(status).not.toBe(0);
  });

  it('rejects a development-only foundation reaching src/', () => {
    plant(
      'packages/token-chunk/src/__validator_probe.ts',
      `import { createFakeClock } from '@llm-kit/test-utils';\nexport const probe = createFakeClock;\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/development-only/);
    expect(status).not.toBe(0);
  });

  it('rejects a dynamic import whose specifier is not a literal', () => {
    plant(
      'packages/token-chunk/src/__validator_probe.ts',
      `const name = 'node:fs';\nexport const probe = async (): Promise<unknown> => import(name);\n`,
    );
    const { status, output } = runValidator('validate-package-boundaries.ts');
    expect(output).toMatch(/not a literal/);
    expect(status).not.toBe(0);
  });
});

describe('validate-package-metadata', () => {
  it('passes on the unmodified repository', () => {
    const { status, output } = runValidator('validate-package-metadata.ts');
    expect(output).toContain('package metadata: OK');
    expect(status).toBe(0);
  });

  it('warns when a repository URL still carries the OWNER placeholder', () => {
    // The placeholder is not a broken URL — `OWNER` is a real GitHub account,
    // so an unreplaced one silently points consumers at a third party. Plain
    // `validate:metadata` warns; `--pre-publish` turns the same finding into
    // a failure, which is what stops `pnpm run release` shipping it.
    const manifestPath = join(REPO_ROOT, 'packages/mend-json/package.json');
    const original = readFileSync(manifestPath, 'utf8');
    try {
      writeFileSync(
        manifestPath,
        original.replace('github.com/SergeevDmitry/', 'github.com/OWNER/'),
      );
      const warned = runValidator('validate-package-metadata.ts');
      expect(warned.output).toMatch(/OWNER/);
      expect(warned.status).toBe(0);

      const blocked = runValidator('validate-package-metadata.ts', ['--pre-publish']);
      expect(blocked.output).toMatch(/OWNER/);
      expect(blocked.status).not.toBe(0);
    } finally {
      writeFileSync(manifestPath, original);
    }
  });
});

describe('validate-readme-examples', () => {
  // These two compile every snippet with `tsc`, so they need far more than
  // vitest's default 5s.
  it('passes on the unmodified repository', () => {
    const { status, output } = runValidator('validate-readme-examples.ts');
    expect(output).toContain('README examples: OK');
    expect(status).toBe(0);
  }, 180_000);

  it('rejects a README snippet that does not compile', () => {
    // Planted in the root README, which this validator checks alongside the
    // package READMEs.
    const marker = '\n<!-- validator probe -->\n\n```ts\nconst x: number = "not a number";\n```\n';
    const readme = join(REPO_ROOT, 'README.md');
    const original = readFileSync(readme, 'utf8');
    writeFileSync(readme, original + marker);
    try {
      const { status, output } = runValidator('validate-readme-examples.ts');
      expect(status).not.toBe(0);
      expect(output).toMatch(/README/);
    } finally {
      writeFileSync(readme, original);
    }
  }, 180_000);
});
