import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'chat-fit',
    include: ['test/**/*.test.ts'],
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/types.ts',
        'src/adapters/structure.ts',
        'src/generated/**',
        'src/**/*.d.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
