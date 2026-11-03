import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // The big flow tests (Agreements, dashboards) can pass 5s when the whole suite runs in one process.
    testTimeout: 20000,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
})
