import { defineConfig } from 'vitest/config';

/**
 * Root-level tests for repository tooling under `scripts/`.
 *
 * `pnpm run test` is `pnpm -r run test`, which only reaches workspace
 * packages — and `scripts/` is deliberately not one. Without this config and
 * the `test:scripts` script that uses it, a test file added beside a
 * validator would sit in the tree looking like coverage while never running
 * in CI. The boundary validator is the mechanism every dependency rule in the
 * repository rests on, so its own tests must actually execute.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
  },
});
