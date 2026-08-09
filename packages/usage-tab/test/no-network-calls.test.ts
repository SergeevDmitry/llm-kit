import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(import.meta.dirname, '..', 'src');

function listFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full));
    } else if (entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const IMPORT_SPECIFIER = /(?:from\s*['"]|require\(\s*['"]|import\(\s*['"])([^'"]+)['"]/g;

function importSpecifiers(contents: string): string[] {
  const specifiers: string[] = [];
  for (const match of contents.matchAll(IMPORT_SPECIFIER)) {
    if (match[1] !== undefined) specifiers.push(match[1]);
  }
  return specifiers;
}

describe('no runtime network fetch, ever', () => {
  it('src/ never calls fetch/XMLHttpRequest and never imports a provider SDK', () => {
    const forbiddenCallPatterns = [/\bfetch\s*\(/, /new\s+XMLHttpRequest\s*\(/];
    const forbiddenImportPatterns = [
      /^node:https?$/,
      /^@anthropic-ai\//,
      /^openai$/,
      /^@google\//,
      /^@google-cloud\//,
    ];

    for (const file of listFiles(SRC_DIR)) {
      const contents = readFileSync(file, 'utf8');
      for (const pattern of forbiddenCallPatterns) {
        expect(pattern.test(contents), `${file} matched forbidden pattern ${String(pattern)}`).toBe(
          false,
        );
      }
      for (const specifier of importSpecifiers(contents)) {
        for (const pattern of forbiddenImportPatterns) {
          expect(
            pattern.test(specifier),
            `${file} imports "${specifier}", matching forbidden pattern ${String(pattern)}`,
          ).toBe(false);
        }
      }
    }
  });

  it('src/ contains no Node built-in import (universal/browser-safe package)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const contents = readFileSync(file, 'utf8');
      for (const specifier of importSpecifiers(contents)) {
        expect(specifier.startsWith('node:'), `${file} imports Node built-in "${specifier}"`).toBe(
          false,
        );
      }
    }
  });

  it('src/ imports only @llm-kit/model-registry as an external dependency (zero runtime deps otherwise)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const contents = readFileSync(file, 'utf8');
      for (const specifier of importSpecifiers(contents)) {
        const isRelative = specifier.startsWith('.') || specifier.startsWith('/');
        expect(
          isRelative || specifier === '@llm-kit/model-registry',
          `${file} imports unexpected external specifier "${specifier}"`,
        ).toBe(true);
      }
    }
  });
});
