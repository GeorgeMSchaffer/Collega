/**
 * ============================================================================
 * THE SWAP POINT — read this before wiring anything to the API.
 * ============================================================================
 *
 * Every call the app makes goes through `API_BASE_URL`. Today that is a same-origin path,
 * `/api/v1`, which the fixture-backed route handler at `apps/web/app/api/v1/[...path]`
 * answers out of the golden corpus. When Nest is real, cutting over is two environment
 * variables and no code change:
 *
 *     NEXT_PUBLIC_API_BASE_URL=https://api.example.test/api/v1
 *     NEXT_PUBLIC_USE_MOCK_API=0
 *
 * The first sends requests to Nest instead of to this app. The second makes the mock route
 * refuse rather than answer, so a stale relative URL somewhere cannot quietly keep serving
 * recordings after the cutover — it fails, visibly, at the first call.
 *
 * The corpus's own base path is `/api/v1` (see `tools/golden/fixtures/manifest.json`) and
 * fixture paths are recorded relative to it, so a base URL ending in `/api/v1` is what makes
 * the recorded paths and the live ones the same strings. Wave F1 gates cutover on Nest
 * replaying these same cases, so a screen built against them works against Nest by
 * construction — provided the base URL is the only thing that moved.
 *
 * These are `NEXT_PUBLIC_` because the browser makes most of the calls. Next inlines them at
 * build time, so a change needs a rebuild, not just a restart.
 */

/** Where the app sends API requests. Default: this app's own fixture-backed mock. */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

/**
 * Whether the mock route answers. Anything but "0" leaves it on, so the default clone runs
 * clickable with no environment at all; setting it to "0" turns every mock response into a
 * refusal that names this file.
 */
export const USE_MOCK_API: boolean = process.env.NEXT_PUBLIC_USE_MOCK_API !== "0";

/**
 * Where a *server-side* caller reaches this app, used only when `API_BASE_URL` is relative.
 *
 * A relative URL is meaningless without a document to resolve it against, and `fetch` in Node
 * rejects one outright — so a server component calling the API through the same client as the
 * browser needs an origin from somewhere. This app's own, by default, on whatever port it was
 * started on. Once `NEXT_PUBLIC_API_BASE_URL` is absolute this is not consulted at all.
 */
export const SERVER_ORIGIN: string =
  process.env.COLLEGA_SERVER_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

/**
 * Server-side only. With it set, the three places the mock would otherwise answer a request
 * the corpus does not literally contain — a substituted path parameter, an ignored query
 * string, an unrecorded case kind — become refusals instead. Use it in CI, or when you want
 * to know exactly how much of a screen is real recording.
 */
export const MOCK_STRICT: boolean = process.env.COLLEGA_MOCK_STRICT === "1";

/**
 * Server-side only. Where the corpus lives, if it is not at `tools/golden/fixtures` in the
 * repository the app is running from.
 */
export const MOCK_FIXTURES_DIR: string | undefined = process.env.COLLEGA_MOCK_FIXTURES_DIR;
