import { defineConfig } from 'vitest/config'

/**
 * The primitives render, so they need a DOM. `jsx` is set here rather than left to `tsconfig.json`
 * so the transform is stated where the test runner reads it.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
  },
})
