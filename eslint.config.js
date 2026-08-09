import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Dynamic code generation via a member expression (SECURITY.md). `no-eval`
 * and `no-new-func` only see the bare identifier, so `globalThis.eval(s)` and
 * `new globalThis.Function(s)` need selectors, and both the call and `new`
 * forms of `Function`, since only one was covered before.
 *
 * Hoisted into a constant because flat config replaces a rule's options
 * rather than merging them: a later config object that sets
 * `no-restricted-syntax` for a matching file wipes every selector an earlier
 * one set. That is how these selectors can end up applying to tests and
 * `scripts/` but not to shipped source — the scoped block below redefines
 * the rule for shipped source to add the dynamic-spread selector, and would
 * silently drop these without the spread. Every block that sets
 * `no-restricted-syntax` must spread this in.
 */
const NO_DYNAMIC_CODE_SELECTORS = [
  {
    selector:
      "CallExpression[callee.type='MemberExpression']" +
      '[callee.property.name=/^(eval|Function)$/]' +
      '[callee.object.name=/^(globalThis|window|self|global)$/]',
    message: 'Dynamic code generation is forbidden.',
  },
  {
    selector:
      "NewExpression[callee.type='MemberExpression']" +
      "[callee.property.name='Function']" +
      '[callee.object.name=/^(globalThis|window|self|global)$/]',
    message: 'Dynamic code generation is forbidden.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '.tmp/**',
      '**/.scratch/**',
      'bench-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Dynamic code generation is forbidden (SECURITY.md).
      // These three built-ins together cover every form: `eval(...)`,
      // `Function(...)` *and* `new Function(...)` — hand-rolled
      // `no-restricted-syntax` selectors missed the call form — and the
      // string-argument variants of `setTimeout`/`setInterval`.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': ['error', ...NO_DYNAMIC_CODE_SELECTORS],
    },
  },
  {
    // Never spread a dynamically sized array into a call.
    //
    // Spread arguments are pushed onto the stack, and the engine caps argument
    // count around 125k — far below what these packages accept as input.
    // Prose alone did not hold this line: the pattern kept recurring in
    // `src/`, and one instance threw a raw `RangeError` on a 2 MB stream and
    // permanently bricked a `mend-json` mender. Every neighbouring guarantee
    // here has a mechanical check; this one now does too.
    //
    // Scoped to shipped source. An array or object literal spread
    // (`[...xs]`, `{...o}`) iterates and is safe — only call arguments are
    // restricted. A genuinely bounded call site is fine with an
    // `eslint-disable-next-line` that names the bound.
    files: ['packages/*/src/**/*.ts', 'internal/*/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        // Re-stated, not inherited: flat config replaces this rule's options
        // wholesale for files this block matches. Without the spread, shipped
        // source would lose the eval/Function selectors entirely.
        ...NO_DYNAMIC_CODE_SELECTORS,
        {
          // Deliberately every call, not just `push`/`concat`/`apply`. A
          // narrower selector matching only known offenders would miss
          // `vec-cache`'s `.run(...args)`/`.all(...args)`, which are safe
          // because they are bounded — a selector that cannot see the safe
          // cases cannot notice when one stops being bounded. This matches
          // nine sites across the shipped tree.
          selector: 'CallExpression > SpreadElement',
          message:
            'Spread arguments go on the stack and are capped around 125k by the engine. Loop instead when the length depends on input. If the length is provably bounded, disable this line with a comment naming the bound.',
        },
      ],
    },
  },
  {
    // "Makes no network calls" (SECURITY.md) is a guarantee about *globals*,
    // not imports — `fetch`, `WebSocket` and friends need no import, so the
    // boundary validator (which only reads import specifiers) cannot see them.
    // This is where that guarantee is actually enforced.
    //
    // The single allowlisted file is the honest statement of the policy: one
    // package wraps a `fetch` whose target the caller supplies, and nothing
    // else in any `src/` touches the network.
    //
    // The glob covers `internal/*/src` as well as `packages/*/src`, because
    // the private foundations are bundled *into* the published packages —
    // `@llm-kit/tokenizer` ships inside `token-chunk` and `chat-fit`,
    // `@llm-kit/model-registry` inside `chat-fit` and `llm-price`. Source that
    // reaches a published tarball has to sit inside the rule that governs
    // published code; scoping this to `packages/` left three packages' bundled
    // source uncovered. `test-utils` and `build-config` are never bundled, so
    // the rule is stricter than strictly necessary for those two — the correct
    // direction for a control whose failure mode is a silent gap.
    files: ['packages/*/src/**/*.ts', 'internal/*/src/**/*.ts'],
    ignores: ['packages/llm-backoff/src/fetch-with-llm-backoff.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Packages must make no network calls (SECURITY.md).',
        },
        {
          name: 'XMLHttpRequest',
          message: 'Packages must make no network calls (SECURITY.md).',
        },
        {
          name: 'WebSocket',
          message: 'Packages must make no network calls (SECURITY.md).',
        },
        {
          name: 'EventSource',
          message: 'Packages must make no network calls (SECURITY.md).',
        },
        {
          name: 'navigator',
          message: 'Packages must make no network calls (SECURITY.md) — including sendBeacon.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'navigator',
          property: 'sendBeacon',
          message: 'Packages must make no network calls (SECURITY.md).',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'Packages must make no network calls (SECURITY.md).',
        },
      ],
    },
  },
  {
    // Plain JavaScript in this repo is Node tooling, not shipped library code.
    files: ['**/*.mjs', '**/*.cjs', 'internal/build-config/*.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
  },
  {
    // Tests, benchmarks, examples and repo scripts are development-only surfaces.
    files: [
      '**/test/**/*.ts',
      '**/benchmarks/**/*.ts',
      '**/examples/**/*.ts',
      'examples/**/*.ts',
      'scripts/**/*.ts',
      'scripts/**/*.mjs',
      '**/*.bench.ts',
      '**/*.test.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
