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
 * preset compiled it with its own toolchain and this file was never consulted. So the name is load
 * bearing: reintroducing `src/main.ts`, or renaming this file, silently hands the deployment back
 * to a source-compiled artifact.
 *
 * The `@nestjs/core` import is what makes the preset accept this file. It reads the entrypoint's
 * own import list to confirm the project is Nest, and does not follow the bootstrap import into
 * `dist/` to find the framework there -- without it the build fails with "No entrypoint found which
 * imports nestjs". Nest is already loaded by the bootstrap, so this adds nothing at runtime.
 *
 * Nothing in this repository asserts any of that. `vercel.json` cannot: `functions` keys must match
 * source files inside an `api` directory, so a glob naming this file is rejected before the build
 * starts. `maxDuration` lives in the project's settings for the same reason.
 */

import '@nestjs/core'

import './dist/bootstrap.js'
