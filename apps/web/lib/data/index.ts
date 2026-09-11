/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async, and each one is either a `fetch` against `apps/api` or still a
 * fixture. The call sites cannot tell which, and that is the point of the indirection: converting
 * a reader replaces a body, never a signature. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37.
 *
 * Converted so far: the board readers, every idea reader — `getIdeasForBoard`, `getIdeaOptions`,
 * `getOrganizationIdeas` and `getIdea` — and the people-and-organization readers: `getProfile`,
 * `getOrganizations`, `getMembers` and `getMembersForOrganization`. Between them,
 * everything `/boards`, `/boards/[boardId]`, `/ideas`, `/ideas/[ideaId]`, `/settings/users`,
 * `/settings/users/import` and `/settings/organizations` read and write. Delivery, the catalogs and
 * the AI screens still answer from `lib/mock.ts`, and the readers that a half-converted screen would
 * otherwise join against real data are named `getFixtureBoards` / `getFixtureBoard` so it is
 * visible which ones those are. `settings/boards` is the last screen calling them.
 *
 * **One join is half-converted right now, knowingly.** `settings/statuses` renders a Site Admin's
 * cross-organization list by looking each organization up in `getStatusesByOrganization`, which is
 * still keyed by the fixture's `'acme-robotics'`/`'blue-harbor'` ids — so with real organizations in
 * hand that lookup misses and the screen shows its empty state. Converting the status catalog is the
 * fix and is a separate slice; nothing here can repair it, because a real status carries a UUID that
 * a fixture board's `statusId` matches nowhere either.
 *
 * There is no `getLastImport` and there cannot be: `lib/data/admin.ts` says why where it used to be.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous, and
 * `lib/server/current-user.ts` for the one place it is fetched.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './ideas'
