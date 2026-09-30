/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async and calls `apps/api`. Until slice 132 some still answered from a
 * fixture, and the call sites could not tell which — that was the point of the indirection:
 * converting a reader replaced a body, never a signature. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37.
 *
 * Converted: every board, idea, catalog, people, delivery, AI settings and Home reader. The idea surfaces
 * (`getIdeaList`, `getBoardIdeaList`, `getIdeaFormOptions`, `getIdea`), the boards
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
 * **Nothing answers from a fixture any more.** The AI settings screens and their usage meter were
 * the last readers on `lib/mock.ts`, and Home the last screen whose content was invented; both read
 * the API now, and the fixture module is gone. The unit tests' seeded identities live in
 * `test/support/`, where no screen can reach them.
 *
 * Home is also where the API's gaps show most plainly: three of its tiles and its activity feed
 * have no route to read, and `lib/data/home.ts` says why they answer null instead of a guess.
 *
 * **Delivery was the last whole module on the fixture, and converting it did not make every
 * delivery screen real.** Sprints and issues are; outcomes have no table, no service and no route
 * to be pointed at, so `getOutcomes`, `getOutcome` and `getIssuesForOutcome` answer empty rather
 * than keeping three invented themes beside live issues. `lib/data/delivery.ts` argues it properly.
 * The roadmap therefore renders its empty state, which is the true thing to render.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous, and
 * `lib/server/current-user.ts` for the one place it is fetched.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './home'
export * from './ideas'
export * from './tags'
export * from './view-as'
