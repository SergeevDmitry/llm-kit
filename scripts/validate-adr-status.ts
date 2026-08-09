/**
 * Keeps ADR governance metadata honest.
 *
 * `docs/adr/README.md` is the index every reader consults to learn which
 * decisions are normative, and each ADR file declares its own `**Status:**`.
 * A reader cannot tell which contracts bind them if the two disagree, so
 * this validator makes that disagreement a CI failure.
 *
 * Run: pnpm run validate:adr
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, Violations } from './lib/workspace.js';

const violations = new Violations();
const adrDir = join(REPO_ROOT, 'docs', 'adr');

const VALID_STATUSES = new Set(['accepted', 'proposed', 'superseded', 'rejected']);

/** `- **Status:** accepted` -> `accepted`. */
function readDeclaredStatus(file: string): string | undefined {
  const contents = readFileSync(join(adrDir, file), 'utf8');
  const match = /^-\s*\*\*Status:\*\*\s*(.+)$/m.exec(contents);
  return match?.[1]?.trim().toLowerCase();
}

/** Every `| [ADR-00X](file.md) | … | … | status |` row of the index table. */
function readIndexStatuses(): Map<string, string> {
  const contents = readFileSync(join(adrDir, 'README.md'), 'utf8');
  const rows = new Map<string, string>();
  for (const line of contents.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const link = /\[(ADR-\d+)\]\(([^)]+)\)/.exec(cells[0] ?? '');
    const status = cells[cells.length - 1];
    if (link === null || status === undefined) continue;
    rows.set(link[2] ?? '', status.toLowerCase());
  }
  return rows;
}

const adrFiles = readdirSync(adrDir)
  .filter((name) => /^ADR-\d+.*\.md$/.test(name) && !name.startsWith('ADR-000'))
  .sort();

if (adrFiles.length === 0) {
  violations.error('docs/adr contains no ADR files');
}

const indexStatuses = readIndexStatuses();

for (const file of adrFiles) {
  const declared = readDeclaredStatus(file);
  if (declared === undefined) {
    violations.error(`${file}: no "- **Status:**" line`);
    continue;
  }
  if (!VALID_STATUSES.has(declared)) {
    violations.error(
      `${file}: status "${declared}" is not one of ${[...VALID_STATUSES].join(', ')}`,
    );
  }

  const indexed = indexStatuses.get(file);
  if (indexed === undefined) {
    violations.error(`${file}: not listed in docs/adr/README.md's index table`);
    continue;
  }
  if (indexed !== declared) {
    violations.error(
      `${file}: declares "${declared}" but docs/adr/README.md's index says "${indexed}" — a reader cannot tell which contracts are normative`,
    );
  }
}

for (const file of indexStatuses.keys()) {
  if (!adrFiles.includes(file)) {
    violations.error(`docs/adr/README.md indexes "${file}", which does not exist`);
  }
}

violations.report('ADR status');
