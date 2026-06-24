import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Playwright E2E spec（e2e/*.spec.ts）は vitest ではなく playwright で実行する（SOT-1154）。
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
