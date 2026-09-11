/**
 * The API's Vercel entrypoint. It imports the compiled bootstrap, whose `app.listen()` call Vercel
 * captures as the application server.
 *
 * Nest relies on decorator metadata emitted by `tsc`, so this file intentionally loads `dist/`
 * rather than the TypeScript source. Keep this as a plain side-effect import: the API has a single
 * bootstrap path and needs no per-route handler wrapper.
 *
 * This file is only reached because the bootstrap is named `src/bootstrap.ts` and not `src/main.ts`.
 * Vercel's NestJS preset resolves an entrypoint in a fixed order, and every `src/` candidate --
 * `main`, `app`, `index`, `server` -- outranks every root-level one. While `src/main.ts` existed the
 * preset compiled it with its own toolchain and this file was never consulted, which is what the
 * `functions` glob in `vercel.json` asserts against: if the preset ever chooses something else, the
 * pattern matches nothing and the build says so instead of deploying the wrong artifact.
 */

import './dist/bootstrap.js'
