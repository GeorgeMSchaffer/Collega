# Decisions

A dated log of decisions that constrain later work. One entry per decision: what was
decided, when, and enough of the reason that a reader six months out does not reopen it
by accident. Newest first.

Supersession is recorded, not edited away — if a decision replaces an earlier one, both
stay, and the older one is marked.

---

## Reading and rotating this log

Read the index, then open only the entries you need. The newest entries are kept in full
below the index; older ones live verbatim in `SPEC/decisions/archive-<from>-to-<to>.md`.

- A new entry goes at the top of the full entries, in full, with a new line at the top of the
  index.
- Once this file passes about 40 KB, the oldest full entry moves verbatim to the newest archive
  file (start a new one, and rename the range, when that file would pass 40 KB). Its index
  line stays and points at the archive.
- When an entry is superseded, mark it where it lives and update its index status.

## Index

Every entry, newest first. "Full below" entries are in this file; the rest are in
`SPEC/decisions/`, verbatim. Status reflects supersession recorded in the log itself.

| Date | Decision | Status | Where |
|---|---|---|---|
| 2026-10-01 | The follow and inbox questions are answered | active | full below |
| 2026-10-01 | The S0.2 schema freeze is amended a fifth time, for idea followers and read state | active | full below |
| 2026-10-01 | The Home dashboard comp is approved as drawn | active | full below |
| 2026-10-01 | Following an idea, and an in-app notification inbox | active | full below |
| 2026-10-01 | The View As banner names only the target | active | full below |
| 2026-10-01 | The View As candidate order, and F1 closes | active | full below |
| 2026-09-30 | What the MVP release includes | active | full below |
| 2026-09-30 | The prompt-eval thresholds stand, confirmed against the v1 baseline | active | full below |
| 2026-09-29 | How the cutover is run | active | full below |
| 2026-09-29 | Board lanes reorder by dragging the header, with buttons as the fallback | active | full below |
| 2026-09-29 | Contracts and wording written from the code | active | full below |
| 2026-09-29 | Removing a lane moves its ideas | active | full below |
| 2026-09-29 | The test harnesses reuse sessions; the auth rate limits stay | active | full below |
| 2026-09-29 | Spec contradictions resolved | active | full below |
| 2026-09-28 | The Idea Field Option contract follows the code | active | full below |
| 2026-09-28 | The v2 corpus format, as built | active | full below |
| 2026-09-28 | The prompt-eval runner's provisional limits stand for the first baseline | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | `compare` refuses to judge an invalid run | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The prompt-eval runner's fixture hash for `compare` is the catalog hash | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The Anthropic client reads no credential or endpoint from the environment | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The prompt-eval runner's open questions are answered | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The prompt-eval runner: what existing decisions already settle | superseded in part | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | Starting a sprint, a single-Issue read, the Roadmap's sprint rows, and tag audit events | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The comp R iteration's open questions are answered | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The S0.2 schema freeze is amended a fourth time, for tag colours | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | Graphite replaces Notte as the dark theme | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-28 | The next comp R iteration is adopted: denser forms, Sprint board, Roadmap, tag colours and Settings → Tags | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-27 | The API sends the custom field list | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-27 | The idea assistant is rescoped as a co-author, and ideas gain structured fields | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-27 | The S0.2 schema freeze is amended a third time, for structured ideas and board archive | active | [2026-09-27 to 2026-09-28](decisions/archive-2026-09-27-to-2026-09-28.md) |
| 2026-09-27 | Terrazzo is the palette, with a theme picker | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | One list and detail pattern, and a drawer instead of the docked inspector | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | The Boards screen has a card view and a list view | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | Desk screens use the full width, and the Boards screens carry the board actions | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | Boards gain a description, and the board list carries what a card needs | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-13 | The AI integration is rescoped and respecified after the current batch | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-13 | The .NET stack is deleted; stale pointers go, inherited rationale stays | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-13 | The usage report returns the contract's `totals`, not the frozen app's flat fields | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-12 | A lockout refuses a wrong password, not a right one | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-12 | The rate limiter's collision with the golden replay is deferred, knowingly | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | The S0.2 schema freeze is amended once, for Issues-and-Delivery Slice 1 | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | The golden replay is not a gate, and never was meant to be one | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | Registration answers `409` again; hiding the status did not close the enumeration oracle | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | The account-lockout denial of service is a known open risk; not fixed now | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | The auth rate limiter sends `Retry-After` and nothing else | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | `POST /auth/register` refuses a taken email generically, and no longer answers `409` | superseded | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | The organization's title rides on `/auth/me`, not on a second call to an admin endpoint | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | How the two Vercel projects are configured, and how production gets its first administrator | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-09 | Shipping for feedback outranks fidelity to the .NET app | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-09 | The drifted database is rebuilt, not migrated | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-08 | Wave G is cut from the conversion and revisited after cutover | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-08 | Application-layer test coverage is paid down alongside Wave D, not after it | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-08 | An empty state's action is disabled with a reason, never omitted | superseded in part | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-07 | The live database cannot accept a Prisma write on seven columns | superseded in part | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-07 | Golden replay cannot authenticate against the Nest API, and F1 is the gate | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | The .NET stack is frozen; its code and instructions are no longer applicable | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Unresolved comment mentions are rejected, not ignored; the contract was wrong | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Wave B conventions: commits, validation errors, and house style | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Entity ids are generated in the application layer, not the domain | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | `.env` is the single home for configuration; a typed config module reads it | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Layer boundaries are enforced by Biome, not eslint-plugin-boundaries | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-04 | .NET development stops; the conversion starts now | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-04 | Sprint 8 is cancelled: the .NET stack is never deployed | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-04 | The idea-type badge moves to the tag row on swimlane cards | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-04 | The session lives in a cookie Nest issues; the reshape takes only what introspection forces | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-03 | The conversion's remaining gates: net-new scope, the test suite, and where it deploys | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-03 | Comp P is the canonical comp; the client is built on Tailwind CSS + shadcn/ui | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | Outcome ↔ Issue cardinality: single-parent | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Golden capture (Wave A) starts now, not with Sprint 9 | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Comp P is the locked UI direction; colour stays open | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Colour may never be the only carrier of meaning | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Home carries two voices, kept apart | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | TypeScript conversion: three constraints settled | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | A denied admin route shows a refusal, not a disabled page | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | Conversion slices merge to `dev`, not to an integration branch | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | The board is a scrolling rail of fixed-width columns | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |

---

## 2026-10-01 — The follow and inbox questions are answered

**Decided by the user**, answering the sixteen questions slice 149 left open in
`20-feature-idea-following.md` (now its "Answered 2026-10-01" section, with each answer). Fifteen take
the recommended default: a removed assignee keeps following; one new type, `IdeaEdited`; delivery-status
moves go to followers; commenting does not follow; one row per person per action, the mention winning;
a Site Admin as themselves cannot follow and has no inbox; nothing here is audited; the inbox shows 90
days and keeps older rows; deleted ideas' notifications are hidden; a row opens the drawer over the
inbox; only opening a row, or Mark all read, marks read; under View As it is the target's inbox; the
count refreshes on navigation and every 60 s; unread is ink and bold, no hue; the toggle shows the count
only.

**Addendum, 2026-10-01 (owner):** each inbox row shows its board name, as the approved comp does (*You
follow this idea · Opportunities*). This supersedes the contract's "no board name is sent". The name is
the idea's **current** board, read at query time through `ideas.board_id`, not captured on the event
(unlike `status_name`, which is history); no schema change. Feature rule 23a; `boardName` in
`contracts/notifications.md`.

**Q13 differs:** a status row **names the new status** (*moved {idea} to In Review*). That needs
`notification_events.status_name`, added to the amendment below, captured at write time.

---

## 2026-10-01 — The S0.2 schema freeze is amended a fifth time, for idea followers and read state

**Follows from the user's decision below** ("The follower list needs a schema change, which amends the
S0.2 freeze a fifth time"). Under the 2026-09-11 rule — the freeze stands, and each change to
`schema.prisma` needs its own entry here — this is that entry, and it is not a general licence. The
columns are slice 149's proposal (`20-feature-idea-following.md` rules 36–39), confirmed when the user
reviews that slice; the build slice writes the migration.

- **New table `idea_followers`** (`id`, `idea_id`, `user_id`, `created_at_utc`), shaped like
  `idea_upvotes`: unique on (`idea_id`, `user_id`), indexed on `user_id`, `ON DELETE CASCADE` from
  `ideas`, no action from `users`.
- **`notification_events.status_name VARCHAR(100) NULL`** (added with the answers entry above): the new
  status's name for the two status events, captured at write time, so a later rename does not rewrite
  history. A narrow typed column rather than JSON metadata, because no other type needs a detail.
- **`notification_events.read_at_utc TIMESTAMPTZ(6) NULL`**, `NULL` meaning unread, and an index on
  (`recipient_user_id`, `occurred_at_utc` DESC) replacing the one on `recipient_user_id` alone.
- **`NotificationEventType` gains `IdeaEdited`** (value 7).
- **The migration backfills** the author and every assignee of each idea that is not soft-deleted as
  followers, so today's recipients keep hearing.
- **Not covered:** a general metadata column on `notification_events`, a follow source column, and any
  purge of old notifications. Each would need its own amendment.

**Golden corpus.** `GET /ideas/{ideaId}` and `PUT /ideas/{ideaId}` gain `isFollowing` and
`followerCount`, so the replay will differ there. Those differences are accepted, and the backend
slice records them in `tools/golden/src/accepted.ts`.

---

## 2026-10-01 — The Home dashboard comp is approved as drawn

**Decided by the user**: build Home from `SPEC/mockups/comp-r-home-dashboard.html` (slice 150) as
it stands. The comp's nine open questions take the comp's own answers: the greeting's "in flight"
counts the backlog plus the Planned and Active sprints' `issueCount`; Complete-lane ideas count as
"still on a board" until status categories exist; the new tiles and panels stay (You created,
Assigned to me list, Most upvoted); the Assigned list keeps the default phase (Issues included); with
two Active sprints the one ending first shows; Read Only keeps the Assigned tile and panel; the Site
Admin fan-out stands; the Site Admin tile reads *Ideas* with the served total; no "Unread for you"
panel for now. Panels marked "Needs" stay placeholders.

---

## 2026-10-01 — Following an idea, and an in-app notification inbox

**Decided by the user** during ad-hoc testing, answering the questions put before specifying it:

1. **Anyone who can see an idea can follow or unfollow it for themselves**, Read Only included.
   Following is a read and grants no access. Nobody adds or removes other people as followers.
2. **The author and every assignee follow automatically** and can unfollow.
3. **Followers are notified of** a new comment, a status change, promotion to an issue, and an edit or
   reassignment (the last is a new event type). For comments and status changes this replaces the
   "author + assignee" recipients in `20-feature-notifications.md`.
4. **Delivery is an in-app inbox** — unread count and a list. Email comes later, once a provider is
   configured; guaranteed delivery stays deferred.

The inbox is a new screen, so it is comp-first. The follower list needs a schema change, which
amends the S0.2 freeze a fifth time. Specified in slice 149, built after the user reviews the comp.

---

## 2026-10-01 — The View As banner names only the target

**Decided by the user** during ad-hoc testing: the banner reads *Viewing as: {Name}*, smaller and in
the theme's own tokens, with the Stop button. The acting admin's name leaves the visible text and
stays in the banner's accessible text and a tooltip. This supersedes in part
`20-feature-view-as.md` rule 22 (both identities named on screen, and the comp's wording); the banner
stays persistent, non-dismissable and on every screen, and every action is still attributed to both.

---

## 2026-10-01 — The View As candidate order, and F1 closes

**Decided by the user**, confirming the order slice 137 built and closing the conversion's replay.

1. **`GET /auth/view-as/candidates` groups by organization**, as `contracts/view-as.md` requires, and
   is ordered by organization title, then organization id, then last name, first name and email.
   Accounts with no organization come last. The user confirmed this order on 2026-10-01.
2. **The three cases that still differ are accepted as "deliberately do better"** (2026-09-11):
   `auth.viewas.candidates.orgadmin`, `auth.viewas.candidates.siteadmin` and `auth.viewas.start`.
   The recording holds the old ungrouped order, which was never specified. Each is recorded in
   `tools/golden/src/accepted.ts`.
3. **F1 closes.** Every difference in the replay is now fixed, accepted or recorded; none is
   unexplained.

---

## 2026-09-30 — What the MVP release includes

**Decided by the user**, answering the scope questions of the MVP release plan
(`SPEC/sprints/sprint-13-mvp-release.md`).

1. **The shared-store hardening is deferred past MVP.** The account-lockout denial of service and
   the per-instance auth rate limiter stay as the tracker's "Known open risks" record them. Their
   one fix, a shared store for both, is scheduled before the first real tenant onboards, not before
   cutover: there are no production users yet, and the store is a new dependency.
2. **The demo-seed routes stay, opt-in only.** `POST /demo-seed` and `/demo-seed/reset` get a
   contract, and `90-definition-of-done.md` gains the exception: they answer only where
   `COLLEGA_ALLOW_DEMO_SEED` is set, which Production never sets. Closes `05` §8 item 7.
3. **F1's remaining non-contract differences are accepted** as deliberate: the export's three new
   columns (4 cases) and the demo seed's delivery module moving ideas out of the Discovery board
   list (14 cases), recorded in `tools/golden/src/accepted.ts`. The View As candidates' order and
   grouping (3 cases) is **not** accepted — `contracts/view-as.md` requires grouping by
   organization — and is fixed instead. With those, F1 closes (2026-09-11: fix, accept, or do
   better).

---

## 2026-09-30 — The prompt-eval thresholds stand, confirmed against the v1 baseline

**Decided by the user**, on the first live run of the v1 corpus (slice 116), as
`SPEC/20-feature-prompt-eval-runner.md` rule 32 asked. Every threshold stays as specified:

- **Refusal recall on `refuse-*` is 1.0** (rule 31). The run held it: 15 of 15.
- **The pair margin is 0.5** (rule 14). The run showed 0.80 (`scope-coffee-narrowed` 5/5 refused,
  `scope-coffee-unnarrowed` 1/5). Raising it was declined: at 5 repeats a half moves in steps of
  0.2, so one noisy trial would cross a tighter margin.
- **The 10% errored-trial limit and the interval rule for regressions** (rules 30 and 32). The run
  had no errored trials.

The baseline is `tools/prompt-eval/baselines/v1-default.json`, recorded at `6969336` with
production's model and effort: 45 trials, overall mapping accuracy 0.95, cost about $0.16. Its weak
spot, `impact-inference` at 2 of 5, is one case of five trials; its interval (0.12 to 0.77) is too
wide for rule 32 to detect a regression there. More business-impact cases were offered and not
taken now.

---

## 2026-09-29 — How the cutover is run

**Decided by the user**, answering the five questions slice 135 left in the cutover runbook
(`SPEC/50-cutover-runbook.md`, conversion slice F4). Each answer is written into the runbook.

1. **A separate staging database comes first.** A staging Prisma Postgres database is provisioned
   before cutover and Preview's `DATABASE_URL` points at it. Until then the release is a no-go —
   today Preview points at the database holding the real Site Admin. An owner step.
2. **Production starts on a new database, not a wiped one.** A new Prisma Postgres database is
   created and Production's `DATABASE_URL` pointed at it; the release build migrates it and creates
   the Site Admin. The old database is kept until the release is confirmed, then deleted — keeping
   it is the rollback for that step, since the pre-release `collega-api` deployment still reads it.
   An owner step. This settles *how* production is seeded fresh (2026-09-09).
3. **`collega-api`'s `maxDuration` is 60 seconds**, set in project settings; `vercel.json` cannot
   hold it.
4. **Production's `COLLEGA_API_URL` is `collega-api`'s production `*.vercel.app` URL.** A custom API
   domain is a later, separate change; `api.collega-ai.com` is not current.
5. **A release goes through a sync branch**, as pull requests #22–#27 did: `dev`'s tip is pushed as
   `sync/<date>`, and pull requests from it go into `dev` and into `main`.

---

## 2026-09-29 — Board lanes reorder by dragging the header, with buttons as the fallback

**Decided by the user** (slice 130), keeping `20-feature-client-ui.md` "Drag-and-Drop: Reordering
Columns" as written: a lane is reordered by dragging its column header, saved immediately on drop.

- **Header drag is the control.** An Org Admin drags a lane by its header onto another lane; the
  drop sends one `POST /boards/{boardId}/swimlanes/reorder` naming every lane with a dense `order`.
  It uses native HTML drag and drop, as the Sprint board's cards do; no dependency is added.
- **Left / right buttons on the header are the accessible fallback**, for the keyboard and screen
  readers, matching the arrows that move a card one lane over. They need no new shortcut (answer
  10 of "The comp R iteration's open questions are answered" rules shortcuts out). After a button
  move, focus stays on the pressed arrow.
- **Both paths behave the same:** the new order shows at once, the lane rail is `aria-busy` and
  the arrows `aria-disabled` while the save is in flight, a polite live region announces the lane's
  new position, and a refusal puts the lanes back with the API's message above them.
- **Who sees them.** An Org Admin, and a Site Admin through View As. The arrows are **hidden** and
  the header does not drag for other roles, under the Denied rule's per-row exception
  (`20-feature-client-ui.md` "Denied is shown, not hidden"): the board page's *Edit board* is still
  shown, disabled with its reason, so the capability is announced once at page level.
- **On an archived board** the header does not drag, and the arrows are shown `aria-disabled`,
  described by a visible line saying the lanes keep their order until the board is unarchived. The
  lanes at either end are `aria-disabled` rather than `disabled`, so the pressed button keeps its
  focus.

The route is the one "Spec contradictions resolved" item 8 chose; that decision stands. This
entry retires item 8's "`apps/web` does not call the reorder route yet" line, which is left as
written with a status note under it.

---

## 2026-09-29 — Contracts and wording written from the code

**An implementation record, not a user decision** (slice 124). Slice 121 listed routes the code
serves and no contract describes, and spec lines the code contradicts. They were written from the
code as it stands, with no code change, and checked against the golden corpus wherever it records
the route. Nothing here changes behaviour; a reader who wants different behaviour needs a decision,
not an edit to these contracts.

- **New contracts:** the six `/organizations/{organizationId}/field-definitions` routes, in a new
  `contracts/field-definitions.md` — reorder is `PUT …/reorder`, with no coverage check, unlike the
  other catalogs' reorders; reads are open to any member of the organization, writes to an
  in-scope Org Admin, and a direct Site Admin is refused. `PUT`/`DELETE /auth/me/portrait` in
  `contracts/auth.md`. The `GET /users/{userId}` success shape, roles and errors in
  `contracts/users.md`.
- **Filled in:** the statuses list item carries `color` and `sortOrder`, the list takes
  `includeDeleted`, and `PUT /statuses/{statusId}` answers the item. The organizations `sortBy`
  sorts by `title` for any value but `createdAt` — so `companyName`, the contract's old spelling,
  and `title`, the item's field, behave the same.
- **Every fixture agrees** except in one field already known: the `profile.portrait.*` fixtures,
  like `auth.me.*`, predate `organizationTitle`.
- **Not written:** `GET /organizations/{organizationId}/users/import-template` appears only in the
  derived `Specs Overview.md`. No code serves it and the corpus does not record it, so there is
  nothing to describe.
- **Decided by the user: the idea form preselects the first active Idea Type too.** The Defaults
  row of `20-feature-ideas-and-engagement.md` and `contracts/idea-field-options.md` already said so,
  but the form preselected neither. It now preselects both on a new idea, so the first type's custom
  fields show at once. An edit keeps the idea's stored values, and "Choose…" stays in each select.
- **Wording:** a required password change ends the session it was made in. The change regenerates
  the user's `SecurityStamp`, and the web client deletes its cookie and returns to
  `/login?passwordChanged=1`. `40-test-strategy.md`, `05-product-definition.md`,
  `20-feature-auth.md` rule 32a and `contracts/auth.md` said the session carried on; each keeps
  a dated note of what it said.

---

## 2026-09-29 — Removing a lane moves its ideas

**Decided by the user.** A board save that removes a lane still holding live ideas moves those ideas
to another lane of the board. The admin picks the target in a confirm step, defaulting to the
board's first remaining lane (*3 ideas are in In Review. Move them to: [New / Pending ▾]*). The API
takes the targets in the save request, refuses a save that removes an occupied lane without one, and
writes a status-change audit entry per moved idea. Archived boards still refuse the save (`409`).
The moves send **no notification** (decided by the user the same day): they reconfigure a board
rather than decide anything about one idea, so `20-feature-notifications.md` trigger 4 carries the
exception.
Applied in slice 123: `20-feature-boards-and-statuses.md` Board rule 14, `contracts/boards.md`
`PUT /boards/{boardId}`, and the Boards header notes in `20-feature-client-ui.md`.

**Why.** Until now the save was accepted and the ideas kept a status that was no longer a column, so
they vanished from the board while still counting in its `ideaCount` (Bug Triage, found in the
review of slice 097). The three answers were to refuse the save, move the ideas, or show them
somewhere; refusing makes the admin move every card by hand first, and a "no column" bucket keeps
the inconsistency and only labels it. Moving them is one decision the admin is already making.

**Settled with it, by the slice** (the lane and status model decides each; none is a new product
choice):

- **Which ideas:** the lane's live `Discovery` ideas — what `ideaCount` and `laneCounts` count and
  the board shows. A promoted Issue keeps its ideation status, which is frozen at promotion for
  provenance; a soft-deleted idea keeps its, since restore is deferred and its row is a retained
  record.
- **Request shape:** `ideaMoves: [{ fromStatusId, toStatusId }]`, one target per removed lane rather
  than one for the whole save, because the confirm step asks per lane and one-for-all is the
  special case of it. The target may be a lane added in the same save.
- **Audit:** `IdeaStatusChanged` in the shape a move on the board writes, and the `BoardUpdated`
  entry records the moves with their counts.

---

## 2026-09-29 — The test harnesses reuse sessions; the auth rate limits stay

**Decided by the user**, closing the two Bug Triage items where the auth rate limiter broke the
golden replay and the Playwright suite. Supersedes in part 2026-09-12 ("The rate limiter's
collision with the golden replay is deferred, knowingly"). Slice 122 applied it.

- **Production limits are unchanged**: login twenty a minute; the auth surface ten a minute and a
  hundred an hour, per IP and per route (`AUTH_THROTTLERS`). The harnesses fit the limits, not
  the other way round. Exempting a harness caller and raising the limits for one stay rejected,
  for 2026-09-12's reasons.
- **The golden replay signs each role in once and keeps the session across scenarios**
  (`tools/golden/src/cli.ts`). It signs every role in afresh after a scenario that starts or ends
  View As (today only `auth`), and drops the sessions of accounts a scenario created for itself
  after every scenario (`profile` changes one's password, which ends its session anyway). About
  sixty logins a run become twelve, three of them the corpus's own `POST /auth/login` cases.
  2026-09-12's objection, that caching weakens the isolation `resetSessions` gave, does not hold on
  Nest: a View As session is a server-side row keyed on the real user and the token is never
  reissued, so a fresh sign-in lands in the same state. The corpus's own `DELETE /auth/view-as`
  steps are what end it; the re-sign after View As is caution, not correctness.
- **The Playwright suite signs each seeded role in once and reuses the cookie via `storageState`**
  (`e2e/tests/auth.setup.ts`, in place since 2026-09-14; the last seeded sign-in outside it, in
  `demo-path.spec.ts`, now uses the stored session). Specs that exist to test signing in
  (`signs-in.spec.ts`, `journey.spec.ts`) and every sign-in as an account a spec just created stay
  real. Fifteen sign-ins a run become fourteen, nine of them as created accounts.
- **Verified 2026-09-29, limits intact, scratch databases:** the full Playwright suite passed
  (38/38). The replay ran all fifteen scenarios to completion on a fresh seed: 360/447 match, 52
  accepted, 35 unexplained, 69 stale accepted entries. The same corpus replayed with the old
  per-scenario re-sign, paced under the limits (a 25-second pause after each scenario), produced
  a byte-identical report, so reusing sessions changes no result.

---

## 2026-09-29 — Spec contradictions resolved

**Decided by the user**, one question at a time, on the contradictions between canonical specs that
the restructure's Phase 2 (slice 120) found. Slice 121 applied them; each is recorded here once.
Where a spec keeps history the old text stays, marked superseded; elsewhere it was rewritten.

1. **Sessions are the httpOnly cookie Nest issues** (2026-09-04). The API sets `collega_session`,
   a signed JWT, on login; `apps/web` re-issues it on its own origin and forwards it; no client
   holds a bearer token. `contracts/auth.md` "Access Token Format and Session Revocation" and the
   rotation gate, `20-feature-auth.md` requirements 33–35 and `20-feature-user-login.md` scenarios
   9–11 now describe that. The browser idle deadline (auth requirements 38–42) is not built in
   `apps/web`, and the contract says so. This supersedes 2026-09-04 decision `08` in part, on two
   points where the code differs: Nest sets the cookie on login only — View As start and exit do
   not touch it — and `apps/web` does hold it, re-issuing it on its own origin and deleting it on
   sign-out; `08` said Nest sets and clears it on login and View As start/exit and Next holds no
   session of its own.
2. **A Site Admin changes organization content only while acting through View As**; organization
   and user administration stay direct. This is the locked 2026-08-11 decision and what
   `ensureNotDirectSiteAdmin` enforces from every service's `ensureAdminScope`. The boards and
   statuses, ideas, and idea-type-fields specs and `contracts/idea-type-fields.md` said otherwise.
3. **Business Impact defaults to the first active option**, like Idea Type: the idea form preselects
   it and the API stores no default; a reorder makes the new first option the preselection. This
   replaces the 2026-08-17 `Medium` default in `20-feature-ideas-and-engagement.md`, kept there as
   superseded. Following 2026-09-28 "The Idea Field Option contract follows the code", the Idea
   Type item in `contracts/idea-field-options.md` also gained the `colorHex`, `icon`, `fieldMode`
   and `fields` the code returns, and the reorder routes their null-body `400` messages.
4. **Lists page at 10 per page, with 25, 50 and 100** (comp R). The 25/50/100/250 rule in
   `20-feature-client-ui-revisions.md` "Uniform List Conventions" is superseded.
5. **Per-organization AI keys stay deferred and unbuilt** (tracker rule 30). Their text stays as
   the specification for later, labelled "Deferred — not built" in `contracts/organizations.md`
   and `20-feature-organizations-and-users.md`.
6. **F1 is not a gate, deleting the .NET stack was not chained to F1, and Wave G waits until after
   cutover** — 2026-09-08 and 2026-09-11, applied to `50-typescript-migration.md`, where the older
   text is marked superseded.
7. **A status colour is `#RRGGBB`**, as the API enforces (`20-feature-boards-and-statuses.md`
   rule 9 said any hex/CSS colour).
8. **Columns reorder with `POST /boards/{boardId}/swimlanes/reorder`**, not the nonexistent
   `PUT /boards/{boardId}/statuses/{statusId}` that `20-feature-client-ui.md` named. `apps/web`
   does not call the reorder route yet: column drag is unbuilt.
   > *Status note 2026-09-29: slice 130 builds the web caller — see "Board lanes reorder by dragging
   > the header, with buttons as the fallback".*
9. **An idea's details open in the drawer at `/ideas?idea={id}`**, not a `/ideas/{id}/edit` route
   (`20-feature-client-ui-revisions.md`).
10. **Idea Type options carry a colour and icon** (Fields rule 9); the ideas spec's decision-table
    row "label and sort order only" is superseded.
11. **The technical plan's `ideas` outline drops `assignee_user_id`**, removed by Phase BE-1 for
    `idea_assignees`. `priority` was listed for removal too, but BE-1 never removed it and it is a
    live column (`Priority` enum in `schema.prisma`), so it stays — reported, not applied.
12. **An unconfigured AI assistant answers `503`**, the same as an unavailable provider or an
    exhausted budget (`20-feature-ai-idea-assist.md` rule 31, matching `contracts/ai-assist.md`).
13. **`SITE_ADMIN_PASSWORD` stays in place** after the first login, because the API refuses to boot
    without it; `50-vercel-deployment.md` §8 said it could be deleted. The guide also now counts
    §11's seven candidates, not six.

**Why record them together.** Each was a place where two canonical documents disagreed, which
AGENTS.md says to ask about rather than pick. They were asked together and answered together, and
none changes code: where a spec and the code differed, the answer was the code. Three gaps remain where
the specs now say more than the code does: the idea form preselects neither option yet (item 3),
the browser idle deadline is unbuilt (item 1), and no client calls the swimlane reorder route
(item 8).

---

## 2026-09-28 — The Idea Field Option contract follows the code

**Decided by the user.** Slice 119 merged the two sections of `30-Contracts.md` headed "Idea Field
Option Contracts" into `SPEC/contracts/idea-field-options.md` and marked eight places where the two
copies, or the text and the code, disagreed. All eight are resolved so the contract says what the
code does today, with no code change — the code has shipped, and a contract the golden corpus pins
should not describe an API that does not exist. For both Idea Types and Business Impacts:

1. **The list** returns active options only unless `includeDeleted=true`, which any caller who may
   read the list may pass (every member of the organization, and a Site Admin); ordered by
   `sortOrder`, then `name`.
2. **The Idea Type item** is the typed shape, including `effectiveFields`.
3. **`sortOrder` on create** is optional: absent, the option goes at the end (the highest existing
   `sortOrder` plus 10). There is no negative check.
4. **`sortOrder` on update** is optional: absent, the option keeps its current value. Updating an
   archived option answers `404`.
5. **Reorder** is `POST …/reorder`, answering `204`.
6. **Reorder must list every active option exactly once** ("The reorder must list every active
   option exactly once."), and archived options are not listed. It sets no default: idea create
   requires an active `ideaTypeId`.
7. **A direct Site Admin is refused** on every mutation with `403` (`ensureNotDirectSiteAdmin`); View
   As is the way in. Listing is unaffected.
8. **Cross-organization access answers `404` "Organization not found."** — an Org Admin mutating
   another organization's options (`ensureAdminScope`), a member reading another organization's list
   (`ensureReadScope`). User and Read Only callers in their own organization still get `403`.

---

## 2026-09-28 — The v2 corpus format, as built

**An implementation note, not a user decision.** Slice 117 builds the provisional v2 case format of
`20-feature-prompt-eval-runner.md` rule 4, and rule 4 now records the choices it made: typed fields
in a separate `acme-v2` fixture so no v1 fixture hash moves; `lockedFields` and `nextStep` in the v2
contract's field names; v2 keys only on `"assistant": "v2"` cases; `suggestions` outside the overall
mapping accuracy. Rule 19 adds a v2 case's `draft` and `lockedFields` to its content hash, since
they drive the run; they are absent from v1 cases, so no v1 hash changes. The format follows the v2
turn contract as specified and changes with it when v2 is built.
