/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async, and each one is either a `fetch` against `apps/api` or still a
 * fixture. The call sites cannot tell which, and that is the point of the indirection: converting
 * a reader replaces a body, never a signature. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37.
 *
 * Converted so far: every board, idea and catalog reader — the idea surfaces (`getIdeasForBoard`,
 * `getIdeaOptions`, `getOrganizationIdeas`, `getIdea`), the boards (`getBoards`, `getBoard`,
 * `getBoardAdmin`), and the organization's statuses, idea types and custom fields. Between them,
 * everything `/boards`, `/ideas`, `/settings/statuses`, `/settings/idea-types`, `/settings/fields`
 * and `/settings/boards/*` read.
 *
 * **There are no `getFixtureBoard*` readers any more.** They existed so a screen that joined a
 * board id against a fixture could not accidentally be handed real boards, and `settings/boards`
 * was the last caller; converting it deleted both the call site and the reader. The status readers
 * were held back for the same reason and are real for the same reason — a fixture board's
 * `statusId` matched no real status, and there is no longer a fixture board to match.
 *
 * What still answers from `lib/mock.ts`: delivery, the organization and member lists, the user
 * import, and the two AI settings screens with their usage meter. `lib/mock.ts` also still holds
 * the seeded boards and ideas the unit tests are written against, which is not a screen reading a
 * fixture — no reader returns them.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous, and
 * `lib/server/current-user.ts` for the one place it is fetched.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './ideas'
