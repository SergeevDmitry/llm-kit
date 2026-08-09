/**
 * Proves that every package advertised as browser-compatible actually bundles
 * for a browser target without pulling in a Node built-in.
 *
 * `vec-cache` is excluded by design: it has no browser build.
 *
 * Run: pnpm exec tsx scripts/browser-bundle-smoke.ts
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { PUBLIC_PACKAGES, Violations, publicPackageDir } from './lib/workspace.js';

const violations = new Violations();
const workRoot = mkdtempSync(join(tmpdir(), 'llm-kit-browser-'));

try {
  for (const [name, rules] of Object.entries(PUBLIC_PACKAGES)) {
    if (rules.runtime !== 'universal') {
      console.log(`${name}: skipped (Node-only package)`);
      continue;
    }

    const entry = join(publicPackageDir(name), 'dist', 'index.js');
    if (!existsSync(entry)) {
      violations.error(`${name}: dist/index.js is missing — run "pnpm run build" first`);
      continue;
    }

    const entryFile = join(workRoot, `${name}-entry.js`);
    writeFileSync(
      entryFile,
      `import * as api from ${JSON.stringify(entry)};\nexport default api;\n`,
    );

    try {
      const result = await build({
        entryPoints: [entryFile],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        write: false,
        // No Node polyfills: a browser build that needs one is a bug.
        external: [],
        logLevel: 'silent',
        metafile: true,
      });

      const inputs = Object.keys(result.metafile.inputs);
      const nodeImports = inputs.filter((input) => input.startsWith('node:'));
      if (nodeImports.length > 0) {
        violations.error(`${name}: browser bundle pulls in ${nodeImports.join(', ')}`);
      }

      const bytes = result.outputFiles?.[0]?.contents.byteLength ?? 0;
      console.log(`${name}: browser bundle ok (${String(Math.round(bytes / 1024))} kB)`);
    } catch (error) {
      violations.error(`${name}: browser bundle failed: ${String(error)}`);
    }
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}

violations.report('browser bundles');
