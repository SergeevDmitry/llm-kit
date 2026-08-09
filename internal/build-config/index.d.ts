import type { Options } from 'tsup';

export interface LibraryBuildOptions {
  /** Entry points relative to the package root. Defaults to `['src/index.ts']`. */
  entry?: readonly string[];
  /** esbuild platform. `neutral` for browser-safe packages, `node` for Node-only ones. */
  platform?: 'neutral' | 'node' | 'browser';
  /** Output formats. Defaults to ESM + CommonJS. */
  format?: readonly ('esm' | 'cjs')[];
  /** Runtime dependencies that must stay external (e.g. `better-sqlite3`). */
  external?: readonly (string | RegExp)[];
  /** esbuild target. Defaults to `node20`. */
  target?: string;
  /** Libraries ship unminified so stack traces stay readable. */
  minify?: boolean;
}

export declare function defineLibraryConfig(options?: LibraryBuildOptions): Options;

export declare function defineNodeLibraryConfig(options?: LibraryBuildOptions): Options;

export declare const PRIVATE_WORKSPACE_SCOPE: RegExp;
