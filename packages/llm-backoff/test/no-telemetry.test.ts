/**
 * Defense-in-depth alongside `pnpm run validate:boundaries`: `src/` must
 * never log, must never import a Node built-in (browser-safe boundary), and
 * `onRetry` must be the only way this package ever surfaces information to a
 * caller. No logging and no telemetry by default.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(import.meta.dirname, '..', 'src');

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = listSourceFiles(SRC_DIR);

describe('no logging, no telemetry, no Node-only imports in src/', () => {
  it('contains no console.* call', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/\bconsole\.\w+\(/);
    }
  });

  it('contains no node: import (browser-safe boundary)', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/from\s+['"]node:/);
      expect(content, file).not.toMatch(/require\(\s*['"]node:/);
    }
  });

  it('contains no eval or dynamic Function construction', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/\beval\(/);
      expect(content, file).not.toMatch(/new\s+Function\(/);
    }
  });

  it('found at least one source file (sanity check the walker itself works)', () => {
    expect(sourceFiles.length).toBeGreaterThan(5);
  });
});
