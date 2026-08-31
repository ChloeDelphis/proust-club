import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/api/schema.generated.ts',
        'src/api/generated/**',
        'src/test/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      // Floor below the measured baseline (92.55% lines on 2026-08-31) — an
      // anti-regression guardrail, not a coverage target. See CLAUDE.md.
      thresholds: {
        lines: 85,
      },
    },
  },
})
