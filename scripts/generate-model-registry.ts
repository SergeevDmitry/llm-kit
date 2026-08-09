/**
 * Generates `internal/model-registry/src/generated/registry.ts` from the
 * reviewed provider source files under `docs/provider-data/`.
 *
 * Usage:
 *   pnpm exec tsx scripts/generate-model-registry.ts          # write
 *   pnpm exec tsx scripts/generate-model-registry.ts --check  # verify only; CI mode, exits non-zero on any diff
 *
 * All shape/order/text decisions live in
 * `internal/model-registry/src/registry-builder.ts`, a pure module unit-tested
 * on its own; this script is the thin I/O wrapper: read source files, run the
 * generator's file-schema validation, hash a version, write or diff.
 *
 * This output is generated, not hand-edited. See
 * docs/provider-data/README.md for the full update workflow.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRegistry,
  canonicalizeRegistry,
  renderRegistryModule,
} from '../internal/model-registry/src/registry-builder.js';
import { validateProviderSourceFile } from '../internal/model-registry/src/schema.js';
import { PROVIDER_IDS, type ProviderId } from '../internal/model-registry/src/types.js';
import { REPO_ROOT } from './lib/workspace.js';

const PROVIDER_DATA_DIR = join(REPO_ROOT, 'docs', 'provider-data');
const OUTPUT_FILE = join(
  REPO_ROOT,
  'internal',
  'model-registry',
  'src',
  'generated',
  'registry.ts',
);
const checkMode = process.argv.includes('--check');

function readProviderSource(provider: ProviderId): unknown {
  const file = join(PROVIDER_DATA_DIR, `${provider}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `Missing docs/provider-data/${provider}.json — every ProviderId needs a reviewed source file, ` +
        'even an empty one with "models": [] and an "omitted" note explaining the gap.',
    );
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const results = PROVIDER_IDS.map((provider) =>
  validateProviderSourceFile(
    readProviderSource(provider),
    provider,
    `docs/provider-data/${provider}.json`,
  ),
);

const { models, issues } = buildRegistry(results);

if (issues.length > 0) {
  console.error(
    `generate-model-registry: ${String(issues.length)} validation issue(s) in docs/provider-data/:\n`,
  );
  for (const problem of issues) console.error(`  FAIL  ${problem}`);
  process.exit(1);
}

const registryVersion = `registry-${createHash('sha256').update(canonicalizeRegistry(models)).digest('hex').slice(0, 16)}`;
const rendered = renderRegistryModule(models, registryVersion);

if (checkMode) {
  const existing = existsSync(OUTPUT_FILE) ? readFileSync(OUTPUT_FILE, 'utf8') : undefined;
  if (existing !== rendered) {
    console.error(
      'generate-model-registry --check: internal/model-registry/src/generated/registry.ts is stale.',
    );
    console.error('Run `pnpm exec tsx scripts/generate-model-registry.ts` and commit the diff.');
    process.exit(1);
  }
  console.log(
    `generate-model-registry --check: OK (${String(models.length)} models, ${registryVersion})`,
  );
  process.exit(0);
}

writeFileSync(OUTPUT_FILE, rendered, 'utf8');
console.log(
  `generate-model-registry: wrote ${String(models.length)} models to ${OUTPUT_FILE} (${registryVersion})`,
);
