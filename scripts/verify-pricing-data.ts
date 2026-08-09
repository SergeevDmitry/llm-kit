/**
 * Validates the reviewed provider source files under `docs/provider-data/`
 * without generating anything — a fast feedback loop for editing pricing
 * data. `generate-model-registry.ts` re-runs the same validation before it
 * writes, so this script can never pass while generation would fail.
 *
 * Usage: pnpm exec tsx scripts/verify-pricing-data.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateProviderSourceFile } from '../internal/model-registry/src/schema.js';
import { PROVIDER_IDS, type ProviderId } from '../internal/model-registry/src/types.js';
import { REPO_ROOT, Violations } from './lib/workspace.js';

const PROVIDER_DATA_DIR = join(REPO_ROOT, 'docs', 'provider-data');
const violations = new Violations();
let totalModels = 0;

for (const provider of PROVIDER_IDS as readonly ProviderId[]) {
  const file = join(PROVIDER_DATA_DIR, `${provider}.json`);
  if (!existsSync(file)) {
    violations.error(`docs/provider-data/${provider}.json is missing`);
    continue;
  }

  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    violations.error(
      `docs/provider-data/${provider}.json: invalid JSON — ${(error as Error).message}`,
    );
    continue;
  }

  const result = validateProviderSourceFile(data, provider, `docs/provider-data/${provider}.json`);
  for (const problem of result.issues) violations.error(`${problem.path}: ${problem.message}`);
  totalModels += result.models.length;
}

console.log(
  `verify-pricing-data: checked ${String(PROVIDER_IDS.length)} provider file(s), ${String(totalModels)} model(s) total.`,
);
violations.report('provider source data');
