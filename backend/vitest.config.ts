import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
    // Suites that start the whole app import every route first, which can take a while on a busy machine.
    hookTimeout: 60_000,
  },
});
