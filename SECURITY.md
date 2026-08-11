# Security policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

Use GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**), which opens a advisory visible only to
the maintainers.

Include the affected package and version, what an attacker can achieve, and a
minimal reproduction if you have one. You should get an acknowledgement within a
few days. Please give us a reasonable window to ship a fix before disclosing
publicly.

## What these packages guarantee

Every package in this repository:

- **makes no network calls.** Nothing here contacts a provider, a telemetry
  endpoint, or an update server. `usage-tab` ships its pricing data as committed
  code precisely so it never has to fetch anything. `chat-fit` summarizes
  through a callback you supply. `llm-backoff` retries a function _you_ pass it.
- **collects no telemetry** and writes no analytics.
- **generates no code at runtime** — no `eval`, no `Function(…)` in either its
  call or `new` form, no string-argument timers.
- **declares no runtime dependencies**, with a single exception: `vec-cache` has
  exactly one, `better-sqlite3`, because it persists to disk.

CI enforces the first, third and fourth of those mechanically, so they cannot
regress quietly:

| Guarantee                  | Enforced by                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No network calls           | ESLint `no-restricted-globals` / `no-restricted-properties` over `packages/*/src/**` **and `internal/*/src/**`**, banning `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon` and `globalThis.fetch`; plus a scan of every packed `dist/*.js`/`*.cjs` in `scripts/validate-published-artifacts.ts` |
| No runtime code generation | ESLint `no-eval`, `no-new-func`, `no-implied-eval`, plus a `no-restricted-syntax` selector for `globalThis.eval` / `window.eval`                                                                                                                                                                                             |
| Dependency policy          | `scripts/validate-package-boundaries.ts` (import graph) and `scripts/validate-published-artifacts.ts` (packed tarball)                                                                                                                                                                                                       |

The network ban is a rule about **globals**, not imports: `fetch` and its
siblings need no import statement, so the boundary validator — which reads
import specifiers — cannot see them and never could. Exactly one file is
allowlisted, `packages/llm-backoff/src/fetch-with-llm-backoff.ts`, which wraps
a `fetch` whose target the caller supplies. That single exception is the honest
statement of the policy.

It covers `internal/*/src` as well as `packages/*/src`, because the private
foundations are bundled **into** the published packages — `@llm-kit/tokenizer`
ships inside `token-chunk` and `chat-fit`, `@llm-kit/model-registry` inside
`chat-fit` and `usage-tab`. Source that reaches a tarball is governed by the
rule that governs published code. And because the guarantee is ultimately about
the artifact rather than the source, `validate:artifacts` independently scans
every packed bundle for the same globals, so a build step could not introduce
one either.

`setTimeout('code')` is caught by `no-implied-eval`, and rejected again by
`tsc`: these packages compile without the DOM library, so the only `setTimeout`
signature in scope takes a function.

## Handling untrusted input

Several packages exist specifically to consume model output, which is untrusted
by construction. Their limits are configurable and enabled by default:

| Package       | Untrusted input                                               | Protection                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mend-json`   | streamed JSON of unknown length and nesting                   | `maxDepth` and `maxBufferBytes` caps, validated eagerly at construction — non-finite, negative, fractional or wrong-typed values throw `INVALID_OPTIONS` rather than silently disabling the cap; incremental scanning that never rescans the buffer. Note that _reading_ `.value`/`repairedJson` is O(buffer), memoized per snapshot — reading it on every `push()` is O(n²) over a stream, so read on a render cadence |
| `token-chunk` | arbitrary documents, including pathological single-token runs | `maxInputChars` cap (default 5,000,000, throws `INPUT_TOO_LARGE`); recursive boundary fallback; boundary detection is linear in input size, with a property test asserting a wall-clock bound so quadratic backtracking cannot return                                                                                                                                                                                   |
| `chat-fit`    | message content of arbitrary shape                            | never throws on unknown content; conservative token accounting                                                                                                                                                                                                                                                                                                                                                          |
| `llm-backoff` | provider response headers                                     | a header whose unit is not confirmed by a provider profile is treated as unusable rather than guessed — misreading one could otherwise mean sleeping for years                                                                                                                                                                                                                                                          |

If you feed genuinely adversarial input, set these limits deliberately rather
than relying on defaults sized for ordinary traffic.

## Data at rest

`vec-cache` is the only package that writes to disk.

- **Plaintext is off by default.** The database stores a SHA-256 cache key and
  the vector, not your source text, unless you opt in with `storeText`.
- **The row's `text_hash` is a weaker digest than the cache key, and is not a
  privacy boundary.** The cache key folds in schema version, namespace, model
  id and (when supplied) dimensions, each length-prefixed. `text_hash` is a
  plain, unsalted `SHA-256` of the text **alone**, stored per row for
  diagnostics and dedup tooling. For short or low-entropy input — a search
  query, a name, a postcode — that is realistically reversible by dictionary
  attack, and unlike the cache key it is not scoped by namespace or model. Do
  not rely on it to keep such input secret; treat the database file as
  confidential whenever it may contain any, exactly as you would the
  embeddings.
- **Treat embeddings as sensitive.** They are derived from your input and can
  leak information about it. The database deserves the same protection as the
  text that produced it.
- **File permissions are yours to set.** The package creates the database with
  your process's umask and does not attempt to tighten it.
- **SQLite deletion is not secure erasure.** Deleted rows may persist in the
  database file, its `-wal` and `-shm` sidecars, and in filesystem free space.
  If you need real erasure, destroy the file and its sidecars.

## Errors and secrets

Package errors carry stable `code` values and never embed authorization
headers, API keys, or user content by default.

`llm-backoff`'s retry events report the chosen delay and, in
`advice.candidates`, the rate-limit header **name and value** that produced it —
never `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`,
`X-Api-Key` or `Api-Key`. `parseRateLimitHeaders` drops any candidate whose
header name matches that list at the point candidates are built, so logging a
retry event wholesale cannot leak a credential even if a future provider
profile widens which headers are inspected.

## Release integrity

Packages are published from `.github/workflows/release.yml` with **npm
provenance**, which cryptographically ties each tarball to the commit and the
workflow run that produced it. Verify it yourself:

```bash
npm audit signatures            # in a project that depends on these packages
npm view token-chunk --json     # `dist.attestations` is present on provenanced releases
```

The npm package page shows a provenance badge linking to the exact workflow run
and source commit. If a version you are installing has no attestation, it did
not come from this pipeline — treat that as a finding and report it.

Third-party GitHub Actions in the release workflow are pinned to full commit
SHAs rather than tags, because the release job holds an npm publish token and an
OIDC identity, and a tag is a pointer its maintainer can move. `actions/checkout`
and `actions/setup-node` remain on major tags deliberately: they come from the
same trust domain that runs the workflow.

## Supported versions

Pre-1.0. Security fixes land on the latest published version of the affected
package. Because the packages are independent, a fix in one does not require
upgrading any other.
