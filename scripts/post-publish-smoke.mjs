/**
 * Installs the published packages from the public npm registry into a clean
 * throwaway project and imports them.
 *
 * This deliberately uses npm artifacts, never workspace builds: the point is
 * to check what consumers actually receive.
 *
 * Run: node scripts/post-publish-smoke.mjs [package ...]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ALL = ['mend-json', 'token-chunk', 'chat-fit', 'llm-price', 'llm-backoff', 'vec-cache'];

/**
 * Packages whose install must run lifecycle scripts. Only `vec-cache` needs
 * them, to build `better-sqlite3`'s native binding — every other package has
 * zero runtime dependencies, so nothing legitimate runs at install time.
 *
 * The rest install with `--ignore-scripts`. This job resolves package names
 * from the public registry and then executes their entry points, which is the
 * point of the smoke test — and unscoped short names carry real
 * typosquatting exposure, so not running install scripts for five of six
 * packages costs nothing and removes the earliest, least-visible execution
 * point. The job already holds only `contents: read` with no OIDC identity;
 * this narrows it further.
 */
const NEEDS_INSTALL_SCRIPTS = new Set(['vec-cache']);
const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ALL;

const workDir = mkdtempSync(join(tmpdir(), 'llm-kit-published-'));
const failures = [];

try {
  writeFileSync(
    join(workDir, 'package.json'),
    `${JSON.stringify({ name: 'published-smoke', private: true, type: 'module' }, null, 2)}\n`,
  );

  for (const name of targets) {
    try {
      // Built without a spread into the call, matching the repository-wide rule
      // even though this file is tooling rather than shipped source.
      const installArgs = ['install', '--no-audit', '--no-fund', '--loglevel=error'];
      if (!NEEDS_INSTALL_SCRIPTS.has(name)) installArgs.push('--ignore-scripts');
      installArgs.push(name);
      execFileSync('npm', installArgs, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      writeFileSync(
        join(workDir, 'smoke.mjs'),
        `import * as api from '${name}';\n` +
          `const names = Object.keys(api).filter((key) => key !== 'default');\n` +
          `if (names.length === 0) throw new Error('${name} exported nothing');\n` +
          `console.log('${name}', names.length, 'exports');\n`,
      );
      const output = execFileSync('node', ['smoke.mjs'], {
        cwd: workDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(`ok  ${output.trim()}`);
    } catch (error) {
      failures.push(`${name}: ${String(error)}`);
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL  ${failure}`);
  }
  process.exit(1);
}

console.log('post-publish smoke: OK');
