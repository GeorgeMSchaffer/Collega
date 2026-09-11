/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async, and each one is either a `fetch` against `apps/api` or still a
 * fixture. The call sites cannot tell which, and that is the point of the indirection: converting
 * a reader replaces a body, never a signature. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37.
 *
 * Converted so far: every board, idea, catalog and people reader. The idea surfaces
 * (`getIdeasForBoard`, `getIdeaOptions`, `getOrganizationIdeas`, `getIdea`), the boards
 * (`getBoards`, `getBoard`, `getBoardAdmin`), the organization's statuses, idea types and custom
 * fields, and the accounts behind them (`getProfile`, `getOrganizations`, `getMembers`,
 * `getMembersForOrganization`, `getInviteCode`). Between them, everything `/boards`, `/ideas`,
 * `/settings/statuses`, `/settings/idea-types`, `/settings/fields`, `/settings/boards/*`,
 * `/settings/users`, `/settings/users/import`, `/settings/profile` and `/settings/organizations`
 * read and write.
 *
 * **There are no `getFixtureBoard*` readers any more.** They existed so a screen that joined a
 * board id against a fixture could not accidentally be handed real boards, and `settings/boards`
 * was the last caller; converting it deleted both the call site and the reader. The status readers
 * were held back for the same reason and are real for the same reason - a fixture board's
 * `statusId` matched no real status, and there is no longer a fixture board to match.
 *
 * The Site Admin's cross-organization status list was briefly broken by exactly that seam: it joins
 * the real organization list against `getStatusesByOrganization`, which was still keyed by the
 * fixture's `'acme-robotics'`/`'blue-harbor'` ids, so every lookup missed. Both halves are real now
 * and the join resolves. It is recorded here because the failure was silent - an empty state, not
 * an error - and the next half-converted join will look the same.
 *
 * There is no `getLastImport` and there cannot be: `lib/data/admin.ts` says why where it used to be.
 *
 * What still answers from `lib/mock.ts`: delivery, and the two AI settings screens with their usage
 * meter. `lib/mock.ts` also still holds the seeded boards and ideas the unit tests are written
 * against, which is not a screen reading a fixture - no reader returns them.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous, and
 * `lib/server/current-user.ts` for the one place it is fetched.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './ideas'
