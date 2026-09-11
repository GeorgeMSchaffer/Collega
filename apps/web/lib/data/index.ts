/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async, and each one is either a `fetch` against `apps/api` or still a
 * fixture. The call sites cannot tell which, and that is the point of the indirection: converting
 * a reader replaces a body, never a signature. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37.
 *
 * Converted so far: the board readers and every idea reader — `getIdeasForBoard`, `getIdeaOptions`,
 * `getOrganizationIdeas` and `getIdea`. Between them, everything `/boards`, `/boards/[boardId]`,
 * `/ideas` and `/ideas/[ideaId]` read and write, the inspector included. Delivery and the settings
 * surfaces still answer from `lib/mock.ts`, and the readers that a half-converted screen would
 * otherwise join against real data are named `getFixtureBoards` / `getFixtureBoard` so it is
 * visible which ones those are. `settings/boards` is the last screen calling them.
 *
 * The status catalog readers stay on the fixture deliberately, and converting them is a separate
 * decision: `settings/statuses` and `settings/boards/*` are still fixture screens, and a real
 * status carries a UUID that a fixture board's `statusId` matches nowhere. Nothing on the idea
 * surfaces needs them any more — a real idea names its own status.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous, and
 * `lib/server/current-user.ts` for the one place it is fetched.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './ideas'
