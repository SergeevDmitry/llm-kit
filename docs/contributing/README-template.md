# README product standard

Every public package README follows this exact section order. The README is
the product: a reader decides in about fifteen seconds whether the package
solves their problem.

## Required order

1. **Package name and one-sentence promise.** No preamble, no logo, no badges above the name.
2. **Two-sentence problem statement.** What breaks today, and why the obvious fix is wrong.
3. **Before/after example.** Runnable code showing the failure and the fix, visible without scrolling far.
4. **Installation.** One command.
5. **Minimal usage.** The smallest useful call, copy-pasteable.
6. **Key guarantees.** The invariants a reader can rely on, stated as guarantees.
7. **API reference.** Every exported symbol, with types.
8. **Advanced options and adapters.** Extension points, provider adapters, injected tokenizers.
9. **Edge cases and limitations.** What the package deliberately does not do.
10. **Runtime compatibility.** Node, Bun, browser, ESM/CommonJS — only what CI actually proves.
11. **Performance/benchmark notes.** Complexity and measured scenarios.
12. **Security/privacy notes.** Telemetry, network calls, data at rest, limits.
13. **Contributing and license.**

## Rules

- Badges go directly under the title line, never above it.
- Every code snippet must compile. Snippets are extracted and typechecked by
  `pnpm run validate:readme`; anything non-compiling must be fenced as `text`.
- Claim only what CI proves. "Bun supported" requires a passing Bun job.
- State the runtime dependency count explicitly — it is a selling point.
- Do not compare unfairly with named alternatives; describe behaviour instead.
- Prefer a real, ugly, realistic example over a toy one.

## Badge block

```markdown
[![npm](https://img.shields.io/npm/v/PACKAGE.svg)](https://www.npmjs.com/package/PACKAGE)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/PACKAGE?activeTab=dependencies)
```

Badges must point at real workflows. A badge for a workflow that does not exist
is a release blocker.
