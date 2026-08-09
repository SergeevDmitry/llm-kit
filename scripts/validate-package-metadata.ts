/**
 * Validates that each package's manifest is shaped for publication.
 *
 * Run: pnpm run validate:metadata
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_PACKAGES, Violations, publicPackageDir, readManifest } from './lib/workspace.js';

const violations = new Violations();

/**
 * `--pre-publish` promotes the checks that only matter at publish time from
 * warnings to errors. Ordinary `pnpm run ci` stays warning-only so unresolved
 * placeholders do not block day-to-day work, but `pnpm run release` runs this
 * mode and refuses to publish.
 */
const prePublish = process.argv.includes('--pre-publish');

const REQUIRED_SCRIPTS = ['build', 'typecheck', 'test'];
const REQUIRED_FILES_ENTRIES = ['dist', 'README.md', 'LICENSE'];

for (const name of Object.keys(PUBLIC_PACKAGES)) {
  const dir = publicPackageDir(name);
  if (!existsSync(dir)) {
    violations.error(`packages/${name} is missing`);
    continue;
  }
  const manifest = readManifest(dir);

  if (manifest.name !== name) {
    violations.error(`${name}: manifest name is "${manifest.name}"`);
  }
  if (manifest.name.startsWith('@')) {
    violations.error(
      `${name}: public packages are published unscoped — scoping is a decision to reverse deliberately, not by editing one manifest`,
    );
  }
  if (manifest.private === true) {
    violations.error(`${name}: must not be private`);
  }
  if (manifest.type !== 'module') {
    violations.error(`${name}: ESM is canonical, expected "type": "module"`);
  }
  if (manifest.license !== 'MIT') {
    violations.error(`${name}: expected "license": "MIT"`);
  }
  if ((manifest.description ?? '').length < 20) {
    violations.error(`${name}: description is missing or too short for an npm listing`);
  }
  if ((manifest.keywords ?? []).length < 5) {
    violations.error(`${name}: at least 5 keywords are required for discoverability`);
  }
  if (manifest.engines?.node !== '>=20') {
    violations.error(`${name}: expected "engines.node": ">=20"`);
  }
  if (manifest.sideEffects !== false) {
    violations.error(`${name}: expected "sideEffects": false`);
  }
  if (manifest.publishConfig?.access !== 'public') {
    violations.error(`${name}: expected "publishConfig.access": "public"`);
  }

  for (const field of ['repository', 'bugs', 'homepage'] as const) {
    if (manifest[field] === undefined) {
      violations.error(`${name}: missing "${field}"`);
    }
  }
  if (manifest.repository?.directory !== `packages/${name}`) {
    violations.error(`${name}: repository.directory must be "packages/${name}"`);
  }

  // `https://github.com/OWNER/...` is not an obviously-broken URL: `OWNER` is a
  // real GitHub organization, so shipping the placeholder points every
  // consumer — and npm's own repository link — at a third party. Hence a hard
  // failure under --pre-publish rather than a warning nobody reads on release
  // day.
  for (const field of ['repository', 'bugs', 'homepage'] as const) {
    const value = manifest[field];
    const url = typeof value === 'string' ? value : (value?.url ?? '');
    if (url.includes('OWNER')) {
      const message = `${name}: "${field}" URL still contains the "OWNER" placeholder — replace it before publishing`;
      if (prePublish) {
        violations.error(message);
      } else {
        violations.warn(message);
      }
    }
  }

  for (const script of REQUIRED_SCRIPTS) {
    if (manifest.scripts?.[script] === undefined) {
      violations.error(`${name}: missing "${script}" script`);
    }
  }

  const files = manifest.files ?? [];
  for (const entry of REQUIRED_FILES_ENTRIES) {
    if (!files.includes(entry)) {
      violations.error(`${name}: "files" must include "${entry}"`);
    }
  }
  for (const entry of files) {
    if (!REQUIRED_FILES_ENTRIES.includes(entry)) {
      violations.error(`${name}: "files" contains unexpected entry "${entry}"`);
    }
  }

  // Entry points must exist on disk after a build.
  const exportsMap = manifest.exports as
    Record<string, Record<string, unknown> | string> | undefined;
  if (exportsMap?.['.'] === undefined) {
    violations.error(`${name}: exports map must define "."`);
  }
  if (exportsMap?.['./package.json'] !== './package.json') {
    violations.error(`${name}: exports map should expose "./package.json"`);
  }

  // Every package advertises both ESM and CommonJS in its exports map.
  const expectedArtifacts = [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
  ];
  const built = existsSync(join(dir, 'dist'));
  if (built) {
    for (const artifact of expectedArtifacts) {
      if (!existsSync(join(dir, artifact))) {
        violations.error(`${name}: built output is missing ${artifact}`);
      }
    }
  } else if (prePublish) {
    // Under --pre-publish these four checks are the point of the run, so a
    // missing dist/ has to fail rather than warn. Warning here would let
    // `pnpm run release` on a clean checkout skip them silently, leaving the
    // artifacts verified only because release.yml happens to run the full
    // `ci` first. Safety that depends on workflow ordering is not safety the
    // gate provides.
    violations.error(
      `${name}: dist/ not present — "pnpm run release" must build before validating for publication`,
    );
  } else {
    violations.warn(`${name}: dist/ not present — run "pnpm run build" before release validation`);
  }

  for (const required of ['README.md', 'LICENSE']) {
    if (!existsSync(join(dir, required))) {
      violations.error(`${name}: ${required} is missing`);
    }
  }
}

violations.report('package metadata');
