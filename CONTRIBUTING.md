# Contributing

Thanks for taking a look. This repository holds six independently published npm
packages that share one toolchain and one quality bar.

## Getting set up

Node.js 20 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm run ci      # lint, format, typecheck, test, build, and every validator
```

`pnpm run ci` from a clean clone is the gate. If it passes, the repository is
releasable; if it fails, nothing else matters.

Working on one package:

```bash
pnpm --filter token-chunk run test
pnpm --filter token-chunk run test:coverage
pnpm --filter token-chunk run bench
pnpm --filter token-chunk run build
```

## The rules that are not negotiable

These are enforced by CI, not by review, so you will find out quickly:

- **Public packages never import one another.** Composition happens in
  `examples/`, not in package source.
- **Only `vec-cache` may have a runtime dependency**, and only
  `better-sqlite3`. Everything else ships with zero.
- **Browser-safe packages import no Node built-ins** from `src/`. Only
  `vec-cache` is Node-only.
- **Private `internal/*` foundations are never published.** They are bundled
  into each public package at build time, and no `@llm-kit/*` import may
  survive in `dist/`.
- **Generated files change only through their generator.** Hand-editing
  `internal/model-registry/src/generated/` will fail `--check` in CI.

## Changing a package

1. Read the package's own docs for its invariants, edge cases, and definition
   of done before you start.
2. Write the test first where you can. Every bug fix needs a regression test.
3. Add a [changeset](https://github.com/changesets/changesets) for any
   user-visible change: `pnpm changeset`.
4. Run the package's definition of done, then `pnpm run ci`.

## Changing pricing data

Pricing lives in `docs/provider-data/` and is compiled into
`internal/model-registry/src/generated/`.

**Every price must be fetched from the provider's own page or API and carry a
`sourceUrl` and an `observedAt` date.** Never add a price from memory. If you
cannot source one confidently, leave the model out and record it in that file's
`omitted` array — under-claiming is correct, and a wrong number in a cost
calculator fails silently.

Rates are decimal **strings** end to end. A price must never pass through a
JavaScript `number` on its authoritative path.

```bash
pnpm exec tsx scripts/verify-pricing-data.ts
pnpm exec tsx scripts/generate-model-registry.ts
pnpm exec tsx scripts/generate-model-registry.ts --check   # must be byte-identical
```

Keep data changes in separate commits from engine changes. A data-only change
still ships a patch release.

## READMEs

A README is the product, not documentation of it. Each one follows the
structure in [`docs/contributing/README-template.md`](docs/contributing/README-template.md),
and **every TypeScript snippet is compiled by CI** (`pnpm run validate:readme`).
Snippets that are deliberately illustrative carry a `no-check` modifier on the
fence — use that sparingly, because an uncompiled example is an example that
will rot.

## Changing a boundary rule

Things like which packages a package may import, or which package gets the
one allowed runtime dependency, are expensive to reverse once other code
depends on them. Open an issue and get agreement before you send a pull
request that changes one.

## Claiming runtime support

Claim only what CI proves. "Works under Bun" requires a passing Bun job that
**exercises** the package, not one that merely imports it — `vec-cache` imports
cleanly under Bun and then fails the moment it opens a database, which is why
`scripts/bun-smoke.ts` runs real work for every package.

## Style

TypeScript in strict mode with `noUncheckedIndexedAccess` and
`verbatimModuleSyntax`. Relative imports carry a `.js` extension. Errors extend
`Error` and carry a stable `code`. Diagnostics are JSON-serializable. Prettier
and ESLint decide formatting and lint — don't argue with them in review.

Write code that reads like the code around it: match the comment density,
naming and idiom of the file you're in.
