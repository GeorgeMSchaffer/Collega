/**
 * The entrypoint Vercel deploys, and the reason it lives here.
 *
 * Vercel's Node runtime builds functions from the `api/` directory and nothing else - a file at
 * the project root is not a function, however the `functions` glob names it. The first attempt put
 * this at `apps/api/server.js` and the build failed with "the pattern server.js defined in
 * functions does not match any serverless functions inside of the api directory", which is that
 * rule stated plainly.
 *
 * A catch-all is what makes one Nest host answer every route: `main.ts` sets a global prefix of
 * `api/v1`, so a request for `/api/v1/auth/me` lands on this file with `v1/auth/me` as the splat
 * and Nest sees the path it expects. A fixed `api/index.js` would only answer `/api`.
 *
 * The import points at `dist/`, not `src/`, and that is the whole job. Nest resolves constructor
 * dependencies from `design:paramtypes`, which only `tsc` with `emitDecoratorMetadata` emits
 * (`apps/api/tsconfig.json` sets it; esbuild does not implement it at all). A build that compiled
 * `src/main.ts` itself would deploy an app whose every provider fails to resolve - at runtime, on
 * the first request, with `Nest can't resolve dependencies of the <Something> (?)`.
 *
 * Vercel's Node runtime captures a server through its `listen()` call, so there is no handler
 * wrapper here and none is wanted. `SPEC/50-vercel-deployment.md` has the rest.
 */

import '../dist/main.js'
