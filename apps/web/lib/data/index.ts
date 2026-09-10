/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async, and each one is either a `fetch` against `apps/api` or still a
 * fixture. The call sites cannot tell which, and that is the point of the indirection: converting
 * a reader replaces a body, never a signature. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37.
 *
 * Converted so far: the board readers, `getIdeasForBoard` and `getIdeaOptions` — between them,
 * everything `/boards/[boardId]` reads and writes. Everything else — the ideas list and
 * detail, delivery, and every settings surface — still answers from `lib/mock.ts`, and the readers
 * that a half-converted screen would otherwise join against real data are named
 * `getFixtureBoards` / `getFixtureBoard` so it is visible which ones those are.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous, and
 * `lib/server/current-user.ts` for the one place it is fetched.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './ideas'
