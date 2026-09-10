/**
 * Vercel detects this NestJS entrypoint automatically. It imports the compiled bootstrap, whose
 * `app.listen()` call Vercel captures as the application server.
 *
 * Nest relies on decorator metadata emitted by `tsc`, so this file intentionally loads `dist/`
 * rather than the TypeScript source. Keep this as a plain side-effect import: the API has a single
 * bootstrap path and needs no per-route handler wrapper.
 */

import './dist/main.js'
