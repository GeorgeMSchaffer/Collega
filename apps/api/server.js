/**
 * The entrypoint Vercel deploys. It exists to point at `dist/`, and that is its whole job.
 *
 * Vercel's Node runtime captures a server through its `listen()` call, and `src/main.ts` already
 * ends in one - so the API needs no handler wrapper, no `@vercel/node` types and no second copy of
 * the bootstrap. What it does need is for Vercel to run the **compiled** output rather than the
 * TypeScript source: Nest resolves constructor dependencies from `design:paramtypes`, which only
 * `tsc` with `emitDecoratorMetadata` emits (`apps/api/tsconfig.json` sets it, and esbuild - what a
 * bundler would reach for - does not implement it at all). A build that compiled `src/main.ts`
 * itself would deploy an app whose every provider fails to resolve, at runtime, on the first
 * request.
 *
 * The name and location are an expectation, not a documented guarantee: Vercel is understood to
 * resolve an entrypoint named app / index / server / main at the project root ahead of anything
 * under `src/`, which is why this file is where it is, but no Vercel document states that ordering
 * and there is no Node equivalent of the entrypoint setting its Python presets expose. The
 * `functions` glob in `vercel.json` is the assertion that it held. Keep this a plain `.js`
 * side-effect import: there is nothing to typecheck, and nothing to compile.
 *
 * `SPEC/50-vercel-deployment.md` §3 has the rest, including what to change if a deployment reports
 * it found a different entrypoint - point the glob at what the build log names; do not rename this
 * file, and do not delete the glob.
 */

import './dist/main.js'
