/**
 * Shared tsup configuration for public llm-kit packages.
 *
 * Invariants enforced here:
 *  - ESM is canonical, CommonJS is generated from the same source;
 *  - private `@llm-kit/*` foundations are bundled into the published artifact
 *    and must never appear as an import in `dist/`;
 *  - declarations, declaration maps and source maps ship with every package;
 *  - browser-safe packages are built for a neutral platform so no Node shim
 *    can sneak into the default entry point.
 *
 * This file is intentionally plain JavaScript: it is loaded directly by tsup's
 * config loader, which does not compile workspace dependencies.
 */
import { fileURLToPath } from 'node:url';

/** Matches every private workspace foundation. */
const PRIVATE_WORKSPACE_SCOPE = /^@llm-kit\//;

/** Absolute path to the monorepo root, derived from this file's location. */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * @param {import('./index.js').LibraryBuildOptions} [options]
 * @returns {Record<string, unknown>}
 */
export function defineLibraryConfig(options = {}) {
  const {
    entry = ['src/index.ts'],
    platform = 'neutral',
    format = ['esm', 'cjs'],
    external = [],
    target = 'node20',
    minify = false,
  } = options;

  return {
    entry,
    format,
    platform,
    target,
    minify,
    // Declaration bundling needs more than `resolve`. tsup's dts step follows
    // a foundation's entry file but stops at that barrel's own relative
    // re-exports, emitting `from './types.js'` into the consumer's `.d.ts` —
    // a path that exists only in the foundation's source tree, so the
    // published types are broken for anyone who installs the package.
    // (`resolve: true` does not fix it; this is not about which specifiers to
    // inline but about how far the declaration program reaches.)
    //
    // Mapping `@llm-kit/*` to the foundation sources puts them inside one
    // declaration program, so every referenced type is inlined for real.
    // `scripts/validate-published-artifacts.ts` fails the build if a relative
    // import ever reappears in a shipped `.d.ts`.
    dts: {
      resolve: [PRIVATE_WORKSPACE_SCOPE],
      compilerOptions: {
        paths: {
          '@llm-kit/*': [`${REPO_ROOT}internal/*/src/index.ts`],
        },
        baseUrl: REPO_ROOT,
        // The declaration program spans this package plus the foundation
        // sources it bundles, so its rootDir must be the repo root — the
        // per-package `rootDir: "."` would reject the foundation files.
        rootDir: REPO_ROOT,
      },
    },
    sourcemap: true,
    clean: true,
    // esbuild already drops unused exports from bundled `@llm-kit/*` sources.
    // tsup's additional rollup pass appends a second `sourceMappingURL`
    // comment to every output file, so it stays off.
    treeshake: false,
    splitting: false,
    shims: false,
    // Private foundations are inlined; declared runtime dependencies are not.
    noExternal: [PRIVATE_WORKSPACE_SCOPE],
    external,
    outExtension({ format: outputFormat }) {
      return { js: outputFormat === 'cjs' ? '.cjs' : '.js' };
    },
  };
}

/**
 * Node-only packages (currently only `vec-cache`) build against the Node
 * platform and keep their native dependency external.
 *
 * @param {import('./index.js').LibraryBuildOptions} [options]
 * @returns {Record<string, unknown>}
 */
export function defineNodeLibraryConfig(options = {}) {
  return defineLibraryConfig({ ...options, platform: 'node' });
}

export { PRIVATE_WORKSPACE_SCOPE };
