import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Component tests need a DOM. The two existing suites (the workflow mirror
    // and the API client) are environment-agnostic and run fine here too, so
    // one environment keeps the config honest rather than split by glob.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
