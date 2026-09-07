import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The client's unit suite. `apps/web` is a Next app, so two things have to be supplied that the
 * `next` CLI would otherwise provide: a DOM, and the `@/` path alias `tsconfig.json` declares.
 *
 * `esbuild.jsx` is set explicitly because `tsconfig.json` says `"jsx": "preserve"` — correct for
 * Next, which does its own transform, and unusable here, where nothing downstream would do it.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL('.', import.meta.url))}/`,
      },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
  },
})
