import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * Fixture loading helpers.
 *
 * Golden fixtures live next to the tests that own them; this module only
 * removes the boilerplate of resolving and parsing them.
 */

export function readFixture(directory: string, name: string): string {
  return readFileSync(join(directory, name), 'utf8');
}

export function readJsonFixture<T = unknown>(directory: string, name: string): T {
  return JSON.parse(readFixture(directory, name)) as T;
}

export interface LoadedFixture {
  /** File name without extension. */
  readonly name: string;
  /** File name with extension. */
  readonly fileName: string;
  readonly content: string;
}

/** Loads every fixture in a directory, sorted by name for deterministic runs. */
export function readFixtureDirectory(directory: string, extension?: string): LoadedFixture[] {
  return readdirSync(directory)
    .filter((fileName) => (extension === undefined ? true : extname(fileName) === extension))
    .sort()
    .map((fileName) => ({
      fileName,
      name: basename(fileName, extname(fileName)),
      content: readFileSync(join(directory, fileName), 'utf8'),
    }));
}
