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
| 2026-09-29 | The test harnesses reuse sessions; the auth rate limits stay | active | full below |
| 2026-09-29 | Spec contradictions resolved | active | full below |
| 2026-09-28 | The Idea Field Option contract follows the code | active | full below |
| 2026-09-28 | The v2 corpus format, as built | active | full below |
| 2026-09-28 | The prompt-eval runner's provisional limits stand for the first baseline | active | full below |
| 2026-09-28 | `compare` refuses to judge an invalid run | active | full below |
| 2026-09-28 | The prompt-eval runner's fixture hash for `compare` is the catalog hash | active | full below |
| 2026-09-28 | The Anthropic client reads no credential or endpoint from the environment | active | full below |
| 2026-09-28 | The prompt-eval runner's open questions are answered | active | full below |
| 2026-09-28 | The prompt-eval runner: what existing decisions already settle | superseded in part | full below |
| 2026-09-28 | Starting a sprint, a single-Issue read, the Roadmap's sprint rows, and tag audit events | active | full below |
| 2026-09-28 | The comp R iteration's open questions are answered | active | full below |
| 2026-09-28 | The S0.2 schema freeze is amended a fourth time, for tag colours | active | full below |
| 2026-09-28 | Graphite replaces Notte as the dark theme | active | full below |
| 2026-09-28 | The next comp R iteration is adopted: denser forms, Sprint board, Roadmap, tag colours and Settings → Tags | active | full below |
| 2026-09-27 | The API sends the custom field list | active | [2026-09-27 to 2026-09-27](decisions/archive-2026-09-27-to-2026-09-27.md) |
| 2026-09-27 | The idea assistant is rescoped as a co-author, and ideas gain structured fields | active | [2026-09-27 to 2026-09-27](decisions/archive-2026-09-27-to-2026-09-27.md) |
| 2026-09-27 | The S0.2 schema freeze is amended a third time, for structured ideas and board archive | active | [2026-09-27 to 2026-09-27](decisions/archive-2026-09-27-to-2026-09-27.md) |
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
  accepted, 35 unexplained, 69 stale accepted entries. The same corpus replayed with the old per-scenario re-sign, paced under the limits (a 25-second pause after each scenario), produced a byte-identical report, so reusing sessions changes no result.

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

---

## 2026-09-28 — The prompt-eval runner's provisional limits stand for the first baseline

**Decided by the user** on review of slice 115. The first v1 baseline (slice 116) is recorded and
judged with the provisional values in `20-feature-prompt-eval-runner.md`: a run with more than 10%
errored trials is not valid (rule 30), and a pair whose refusal rates differ by less than 0.5 is
flagged "scope statement may be ignored" (rule 14). Both are revisited with the user against the
real rates once that baseline exists (rule 32), not before it.

---

## 2026-09-28 — `compare` refuses to judge an invalid run

**Decided by the user** on review of slice 115. `compare` exits 2, printing the reasons, when
either run is itself not valid under `20-feature-prompt-eval-runner.md` rules 30–31 — aborted,
more than 10% errored trials, or an errored `refuse-*` trial — rather than comparing it. A
regression or a clean result against a run that could not be judged on its own would be a verdict
about nothing. Recorded in rule 30.

---

## 2026-09-28 — The prompt-eval runner's fixture hash for `compare` is the catalog hash

**An implementation correction, not a user decision.** Found while building slice 114:
`20-feature-prompt-eval-runner.md` rule 19 hashed each fixture's rendered system prompt, and rule 34
said only the template hash should differ between a baseline and a candidate. A rendered prompt
always changes with its template, so every prompt comparison would have warned on every fixture.
Rule 19 now keeps that hash (`fixtureHashes`) and adds a catalog hash (`fixtureCatalogHashes`): the
fixture rendered through a template of only the two placeholders, plus the response schema. Rule 34's
like-with-like check uses the catalog hash. Rule 40 also now names `pnpm -C tools/prompt-eval eval`,
because `pnpm --filter` reports every failure as exit 1.

---

## 2026-09-28 — The Anthropic client reads no credential or endpoint from the environment

**Decided by the user** on review of slice 114. `AnthropicIdeaDraftModel` constructs the SDK
client with `apiKey` from configuration, `authToken: null`, and the SDK's default API URL
(`https://api.anthropic.com`) as an explicit `baseURL`. Left unset, the SDK falls back to
`ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL`: a stray token would ride along on every request,
and a stray base URL would send the configured key to another host. Pinning both means the key the
API or the prompt-eval runner was given, sent to Anthropic, is the only credential in play. The
API's behaviour is otherwise unchanged — the same key, the same endpoint, and no client when the key
is blank. Recorded in `20-feature-prompt-eval-runner.md` rule 37.

---

## 2026-09-28 — The prompt-eval runner's open questions are answered

**Decided by the user**, answering the eleven questions slice 113 left open, each with the
recommended option. Each answer is written into `20-feature-prompt-eval-runner.md` and
`SPEC/sprints/sprint-12-prompt-eval-runner.md`, and the *(pending answer)* markers are gone. This
completes the entry below, which said which key and who pays were open.

1. **Packaging:** a new workspace package, `@collega/prompt-eval`, in `tools/prompt-eval`, depending
   on `@collega/application` and `@collega/infrastructure`, with no new third-party package. It is
   the first `tools/` package allowed to depend on infrastructure, approved for this.
2. **What a run drives:** the `IdeaDraftModel` port on the production `AnthropicIdeaDraftModel`, with
   `sanitizeDraft` exported from the idea-assist service so the output is scored as the service
   returns it. Not the whole service with fake ports, and not the HTTP API.
3. **Model:** production's model and effort, read from the shared constant, with `--model` and
   `--effort` overrides that the run header records and `compare` flags.
4. **Key:** a dedicated evaluation key, never the production deployment key, supplied as
   `ANTHROPIC_API_KEY` from the environment or the root `.env`. *The variable name is superseded by
   answer 12.*
5. **The scope gate's positive class is a refusal**, so recall is the security figure.
6. **Defaults:** 5 repeats, `--max-calls 200`, `--max-tokens 1,000,000`, concurrency 1, and `--yes`
   required when a run plans more than 100 calls.
7. **Thresholds:** refusal recall of 1.0 on the `refuse-*` cases as an absolute floor; every other
   metric judged against the committed baseline; a collapse in cache reads and a surviving locked
   field fail outright. Revisited once the first baseline shows the real rates. The spec's 10%
   errored-trial limit, above which a run is invalid, is provisional with these thresholds.
8. **v1 and v2:** v1 is measured now and its baseline committed; the v2 case format and scorer are
   built now; the live v2 run lands with v2.
9. **Case format:** the optional `pair` and `assistant` keys are added.
10. **Run outputs:** `runs/` is gitignored; only promoted baselines are committed.
11. **No CI for now.** Runs are local, and the summary goes with the review of a prompt change.
12. **The runner's key has its own name** (decided after the other eleven). The runner reads only
    `PROMPT_EVAL_ANTHROPIC_API_KEY`, from the environment or the root `.env`, and refuses to run
    without it. It never reads `ANTHROPIC_API_KEY`, so it cannot pick up the API's key by accident —
    both would otherwise sit in the same `.env` under the same name. It passes the key to the
    production adapter explicitly. This supersedes in part the entry below ("One key, under the name
    already fixed") and answer 4's variable name.

---

## 2026-09-28 — The prompt-eval runner: what existing decisions already settle

**Recorded, not newly decided.** Slice 113 specifies the runner (`20-feature-prompt-eval-runner.md`)
as the phase the order of work below puts next. Each point here follows from text the user has
already approved; everything else in that spec is marked *(pending answer)* until answered.

- **It is TypeScript, and it gates v2.** v2 is not enabled until the runner reports, at minimum,
  scope-gate precision/recall and field-mapping accuracy against the corpus extended with v2 cases
  (2026-09-27 "Measurement comes first"; `20-feature-ai-idea-assist-v2.md` "Prerequisite:
  measurement").
- **The corpus is `tools/prompt-eval` as it stands, with its methodology**: repeats reported as
  rates, only declared expectations scored, refused turns dropped mid-case, the coffee pair read
  together, compare like with like (`tools/prompt-eval/README.md`, carried over by the 2026-09-13
  F6 entry).
- **It never runs in the hermetic gate.** Tests make no network call (`AGENTS.md`) and the provider
  is never called from the test suite (`40-test-strategy.md` "AI Idea Assist"). A live run is a
  separate command.
- **One key, under the name already fixed.** `ANTHROPIC_API_KEY` (v1 rule 29); per-organization keys
  stay unimplemented (tracker rule 30). Which key value it uses, and who pays, is open.
  *Superseded in part 2026-09-28 (the answers entry above, answer 12): the runner reads its own
  `PROMPT_EVAL_ANTHROPIC_API_KEY` and never `ANTHROPIC_API_KEY`. One key, and no per-organization
  keys, still stand.*
- **The `tools/*` conventions hold**: `node:test`, Node's own type stripping, no test framework
  (`tools/arch/identity-chokepoint.test.ts` records why), and no new dependency without approval.

---

## 2026-09-28 — Starting a sprint, a single-Issue read, the Roadmap's sprint rows, and tag audit events

**Decided by the user**, answering the three points the answers entry below left open, and on review of this slice, the audit of tag changes.

- **Start sprint on the Sprint board.** When no sprint is `Active`, the board shows the next
  `Planned` sprint (earliest start) with **Start sprint** behind a confirmation, on the existing
  `POST /organizations/{orgId}/sprints/{sprintId}/start`, for the same roles as *Complete sprint*.
  Without it a completed or newly planned sprint could never become the running one from the app.
- **A single-Issue read, under the existing convention:** `GET /ideas/{ideaId}/delivery` returns one
  Issue's delivery card. Same authorization as the delivery lists; `404` for another organization's
  Issue, a Discovery idea, a deleted one or a malformed id. It replaces the web app's fan-out over
  every sprint and the backlog, and serves the Issue drawer's deep link and
  `/delivery/issues/{ideaId}`. Like every delivery route it addresses the idea by its id, so there
  is still no `/issues` root.
- **The Roadmap's sprint rows stay** as drafted; whether they stay once Outcomes exist is decided in
  the Outcomes sprint.
- **A tag rename and a tag delete each write one audit event** — `TagRenamed` and `TagDeleted`,
  with the tag's id, its old and new name and the number of ideas affected. The ideas are not
  touched: no per-idea events, and their `updatedAtUtc` stays. This replaces the adoption draft's
  "no audit event" for tags (`20-feature-ideas-and-engagement.md` rule 15, `30-Contracts.md`).

---

## 2026-09-28 — The comp R iteration's open questions are answered

**Decided by the user**, answering the ten questions left open by the adoption entry below, plus the
order of work. Each answer is written into the spec where it applies, and the *(pending answer)*
markers are gone.

1. **Outcomes: the screen now, the backend later.** Sprint 11 restructures the Roadmap against the
   data that exists — the Weeks / Months / Quarters axis, the TODAY rule, the organization's sprints
   as rows, and an empty state where outcomes will go, with *Add New Outcome* disabled and its
   reason given. Slice 2's backend (the `outcomes` table with its colour, `ideas.outcome_id`, the
   routes and the roadmap read) is a gap for a later sprint, with its own schema amendment; the
   fourth amendment covers `tags.color` only. Chosen over building Slice 2 now and over deferring
   the whole Roadmap.
2. **Bug Triage exception granted for Sprint 11, on one condition:** slice 106 also fixes the
   `db:seed` `P2002` on `board_swimlanes` item, since it changes the seed anyway. The other four
   `TODO` items stay queued.
3. **Issue keys are left out of every screen for now**, and decided separately.
4. **Colours are the palette plus a custom colour.** The picker offers ten swatches and a Custom
   input; the API accepts any `#RRGGBB`. Because a custom colour can be anything, a chip's text
   colour is computed per theme to clear 4.5:1 rather than fixed (`20-feature-client-ui.md` "Tag
   colours and the effort bar"), and a test proves it over the palette and the extreme colours.
   Outcome colours follow when Outcomes are built, with their bar label's contrast computed too.
5. **Settings → Tags is Org Admins' only**, read-only for a Site Admin; members do not see it. The
   tag catalog read stays open to members, because the Ideas Tags filter every role uses needs the
   full set (`30-Contracts.md` says why).
6. **The effort bar is on idea cards and rows too**, whenever an effort is set; idea list items carry
   `effort`.
7. **An Issue opens in the drawer** from the Sprint board, the Backlog and the Roadmap, with its
   delivery facts — status selector, effort, sprint, outcome, provenance and tasks.
8. **Plan next sprint opens an Add New Sprint form in the drawer** (name, goal, dates, owner) on the
   existing `POST /organizations/{orgId}/sprints`.
9. **The Roadmap's window is fixed and anchored on today:** Weeks shows 16 weeks from two weeks back,
   Months 7 months from this month, Quarters 4 quarters from this quarter; no panning.
10. **No keyboard shortcuts anywhere:** no *Ctrl ↵* save, no zoom keys, no key-hint chips. Escape
    still closes the drawer and the dialogs.
11. **Order of work:** Sprint 11 first, then the prompt-eval runner, then idea assistant v2.

---

## 2026-09-28 — The S0.2 schema freeze is amended a fourth time, for tag colours

**Decided by the user** with the adoption below ("Tags get a colour picker; by default a tag gets a
random colour"). Under the 2026-09-11 rule — the freeze stands, and each change to `schema.prisma`
needs its own entry here — this is that entry, and it is not a general licence.

- **`tags`** gains `color VARCHAR(7) NOT NULL` — any `#RRGGBB`, stored upper case
  (`20-feature-ideas-and-engagement.md` Tags rule 9). No other column: `tags` already has
  `created_at_utc` and `created_by_user_id`, which Settings → Tags shows.
- **The migration backfills every existing tag** with the palette colour at index
  `get_byte(decode(md5(normalized_name), 'hex'), 0) % 10`, indexing Tags rule 9's palette in its
  listed order (`#E5484D` is 0, `#94A3B8` is 9), so the result is repeatable across databases and
  replays; then sets `NOT NULL`. The demo seed computes the same index in `node:crypto` (the first
  byte of the MD5 digest of the normalized name, modulo 10). Tags created afterwards take a random palette colour chosen by the application, from an
  injected random source.
- **Not covered: Outcomes.** Sprint 11 builds the Roadmap screen, not its backend (the answers
  entry above), so the `outcomes` table — with its `color VARCHAR(7) NOT NULL`, added to the spec
  2026-09-28 — and `ideas.outcome_id` wait for the later sprint that builds Slice 2, under an
  amendment of their own.
- **Not covered:** an issue key or idea reference (comp R's `IDE-01`). That needs its own decision
  and its own amendment.

**Golden corpus.** Board list items gain `topTags[].color`; idea list, detail and delivery items
gain `tags`; and idea list items (the board list and the organization list) gain `effort` — so the
replay will differ there. Those differences are accepted, and the backend slice
records them in `tools/golden/src/accepted.ts`.

## 2026-09-28 — Graphite replaces Notte as the dark theme

> Supersedes in part 2026-09-27 "Terrazzo is the palette, with a theme picker", which named Notte as
> the dark theme.

**Decided by the user** from their design canvas: "Graphite replaces Notte as the dark theme." The
picker offers Terrazzo (default), Portico, Piazza Sera and Lagoon as light themes and **Graphite** as
the dark one: a near-black neutral ground, near-white ink, an amber primary and a cyan metric and
suggestion hue, in IBM Plex Sans with JetBrains Mono (`20-feature-client-ui.md` "Themes", token
values in comp R's `graphite` block). Notte's self-contained `[data-theme]` block, shipped in slice
100, is replaced rather than kept as a sixth theme, and a `collega-theme` cookie that still says
`notte` is served Graphite, so a person who chose dark stays in dark. The 4.5:1 rule is unchanged;
Graphite's pairs were measured against it on 2026-09-28. The Terrazzo default, the per-browser
cookie and the per-theme suggestion hue all stand.

## 2026-09-28 — The next comp R iteration is adopted: denser forms, Sprint board, Roadmap, tag colours and Settings → Tags

**Decided by the user** ("go ahead with it"), reviewing the iteration of
`SPEC/mockups/comp-r-portico-prototype.html` that folds in their design canvas. In the user's words,
in substance: integrate the Graphite theme and the denser form and control layout; refactor the
Roadmap structurally and functionally to match, with Weeks, Months and Quarters as its zoom levels
and no keyboard shortcuts for now; add the effort bar to cards, the sprint lanes included; add the
Sprint board; give tags a colour picker, a random palette colour by default, changed by an
administrator in Settings; and add Settings → Tags on the list and detail pattern — list, view,
edit (name and colour), delete, and add in advance of use.

- **Where it is written.** Forms and controls, tag chip colours and the effort bar:
  `20-feature-client-ui.md`. Tag colour and Settings → Tags: `20-feature-ideas-and-engagement.md`
  "Tags" rules 9–15. Sprint board, Roadmap and the effort bar's placement:
  `20-feature-issues-and-delivery.md` "Comp R iteration". Contracts: `30-Contracts.md`, each
  addition dated 2026-09-28. The work is planned as Sprint 11
  (`SPEC/sprints/sprint-11-comp-r-iteration.md`).
- **The denser layout applies in every theme**, not only Graphite: 32px buttons, 34px fields,
  12px labels, short fields three or two to a row. It supersedes the control heights slice 100
  shipped.
- **Tag chip text is required to clear 4.5:1 in every theme.** Comp R's colour mix fails it in the
  light themes for seven of the ten palette colours; the spec keeps the rule and fixes the mix rather
  than accepting the comp.
- **Tags are administered by the Org Admin** (a Site Admin through View As), like the other
  organization configuration collections. The tag rules had never named an administrator — anyone
  who could edit an idea could create a tag, and nobody could rename, recolour or delete one — so
  this is a reading of the existing permission model, recorded so it is not mistaken for a new
  rule. Inline creation while tagging an idea is unchanged.
- **Two things comp R draws have no backend, and this adoption does not invent one.** Issue keys
  (`IDE-01`) are left out of every screen until they are decided separately; Outcomes (Slice 2)
  stay specified and unbuilt — Sprint 11 builds the Roadmap screen without them (answered the same
  day). Both are recorded as gaps in `30-Contracts.md`.
- **Where comp R and the spec disagree, the spec wins** and the difference is written down: the
  outcome drawer's Delete confirms (comp R deletes at once), and comp R's *Ctrl ↵* save is not built.
- **Open at adoption, answered the same day** — see "The comp R iteration's open questions are
  answered" above.

---

## Earlier decisions

Decisions made before this log existed are recorded in the documents they constrain —
chiefly `SPEC/95-next-sprints.md` (sprint sequencing and the paydown-first rule),
`SPEC/implementation-agent-tracker.md` (build state and standing rules), and the
"Settled during charting" table in the conversion map. They are not restated here; this
log starts 2026-08-31 and runs forward.
