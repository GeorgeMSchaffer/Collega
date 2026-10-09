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
| 2026-10-04 | `compare` judges the cases both runs share; none shared is exit 2 | active | full below |
| 2026-10-04 | The App Admin's sidebar offers Home and Settings only | active | full below |
| 2026-10-04 | The Site Admin role is shown as App Admin | active | full below |
| 2026-10-04 | An organization is created with its first Org Admin | active | full below |
| 2026-10-04 | Three vertical demo organizations join Acme and Blue Harbor | active | full below |
| 2026-10-04 | The sign-in pitch shows the product, not the primary colour | active | full below |
| 2026-10-04 | Users create boards; managing them stays Org Admin | active | full below |
| 2026-10-04 | One Enter adds a tag on the idea form | active | full below |
| 2026-10-04 | Graphite is the default theme | active | full below |
| 2026-10-04 | Fieldsets: reusable groups of fields, attached to idea types | active | full below |
| 2026-10-01 | The Home comp is a visual guide; the spec wins | active | full below |
| 2026-10-01 | The follow and inbox questions are answered | active | full below |
| 2026-10-01 | The S0.2 schema freeze is amended a fifth time, for idea followers and read state | active | full below |
| 2026-10-01 | The Home dashboard comp is approved as drawn | amended | full below |
| 2026-10-01 | Following an idea, and an in-app notification inbox | active | full below |
| 2026-10-01 | The View As banner names only the target | active | full below |
| 2026-10-01 | The View As candidate order, and F1 closes | active | full below |
| 2026-09-30 | What the MVP release includes | active | full below |
| 2026-09-30 | The prompt-eval thresholds stand, confirmed against the v1 baseline | active | full below |
| 2026-09-29 | How the cutover is run | active | [2026-09-29 to 2026-09-29](decisions/archive-2026-09-29-to-2026-09-29.md) |
| 2026-09-29 | Board lanes reorder by dragging the header, with buttons as the fallback | active | [2026-09-29 to 2026-09-29](decisions/archive-2026-09-29-to-2026-09-29.md) |
| 2026-09-29 | Contracts and wording written from the code | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-29 | Removing a lane moves its ideas | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-29 | The test harnesses reuse sessions; the auth rate limits stay | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-29 | Spec contradictions resolved | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The Idea Field Option contract follows the code | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The v2 corpus format, as built | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner's provisional limits stand for the first baseline | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | `compare` refuses to judge an invalid run | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner's fixture hash for `compare` is the catalog hash | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The Anthropic client reads no credential or endpoint from the environment | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner's open questions are answered | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner: what existing decisions already settle | superseded in part | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | Starting a sprint, a single-Issue read, the Roadmap's sprint rows, and tag audit events | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The comp R iteration's open questions are answered | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The S0.2 schema freeze is amended a fourth time, for tag colours | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | Graphite replaces Notte as the dark theme | superseded in part | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The next comp R iteration is adopted: denser forms, Sprint board, Roadmap, tag colours and Settings → Tags | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | The API sends the custom field list | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | The idea assistant is rescoped as a co-author, and ideas gain structured fields | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | The S0.2 schema freeze is amended a third time, for structured ideas and board archive | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
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

## 2026-10-04 — `compare` judges the cases both runs share; none shared is exit 2

**An implementation reading, approved by the user 2026-10-09** (slice 174), settling what
`20-feature-prompt-eval-runner.md` rule 33 ("for the cases both share") leaves open for `compare`:

- **Every figure is computed over the shared case ids**, both runs restricted to them before the
  metrics, the rule 32 regressions, the cache guard and the locked-field check. The cases left out
  of each side are listed. Identical case sets compare exactly as before.
- **Validity stays a property of each whole run.** An aborted run, more than 10% errored trials or
  an errored `refuse-*` trial anywhere still makes `compare` exit 2 (2026-09-28, "`compare` refuses
  to judge an invalid run"): excluding a case cannot repair a run that was not valid.
- **No shared case is exit 2**, not 0: there is nothing to judge, and a pass would be a verdict about
  nothing — the same reasoning as the 2026-09-28 entry.
- **The case-selection warning stays** (rule 34): a different selection is still not like with like.

---

## 2026-10-04 — The App Admin's sidebar offers Home and Settings only

> Supersedes in part `20-feature-client-ui-revisions.md`'s "Site Admin … Boards, Ideas … list views
> aggregate all organizations".

**Decided by the user.** An App Admin (Site Admin) acting as themselves changes boards, ideas and
delivery only through View As, and their own lists of them were empty, so the sidebar and the
command palette no longer offer them Boards, Ideas, Sprint board, Backlog or Roadmap — those showed
a 0 count and an empty screen. Home's platform roll-up still links to each board for reading. A group left
empty (Delivery) loses its heading. Under View As the role is the target's, so the links return.
The routes themselves are unchanged.

---

## 2026-10-04 — The Site Admin role is shown as App Admin

**Decided by the user**, who names the four roles App Admin, Org Admin, User and Read Only. Every
user-visible label and message in `apps/web` says **App Admin**. The role's value (`SiteAdmin`),
the API, its contracts and error messages, the golden corpus, the specs and code comments keep
"Site Admin": renaming those is a large, risky change for no user-facing gain, and the specs read
"Site Admin" as the role's name. API error text a screen shows verbatim (the View As refusal) still
says "Site Admin" until a later slice changes it.

---

## 2026-10-04 — An organization is created with its first Org Admin

**Decided by the user.** The App Admin (the role the code calls Site Admin) reaches an
organization's users, tags, custom fields, boards and ideas only by acting as a member (rule 25
stands), so an organization with no active Org Admin is unreachable. The user chose to close that by
construction rather than give the App Admin direct access:

- **Creating an organization requires its first Org Admin** — name, email, initial password. The
  form and the server action refuse before the organization is created when any is missing.
- **The organization's page lists its Org Admins**, warns when none is active, and offers **Add Org
  Admin**: Add New User preset to that organization and the Org Admin role (direct user
  administration is rule 26's bootstrap exception). A deactivated admin is reactivated from their user
  page.

Rejected: letting the App Admin edit organization settings directly, which would reverse rule 25 and
attribute organization changes to someone outside it.

---

## 2026-10-04 — Three vertical demo organizations join Acme and Blue Harbor

**Decided by the user.** The generic demo data (the same eleven scenarios on every board, prefixed
with the board's focus) is too thin to demo to a market. The seed now also creates three
organizations written for a vertical: **Pinecone Labs** (an Agile software team), **Brightline
Creative** (a marketing agency) and **Meridian Holdings** (a corporate business-improvement
programme, "Project Lighthouse"). Each has two boards of 11 themed ideas (3/2/2/1/3 across the default
statuses), themed tags, comments, a sprint with promoted issues and checklists, and one account per
role - Org Admin, two Users, Read Only - on the same `orgadmin`/`user`/`user2`/`readonly` local parts.

**Acme Robotics and Blue Harbor Logistics are kept unchanged** and stay first in the scenario: about
60 golden fixtures, the E2E suite and `apps/web`'s test fixtures pin them by slug, and the corpus
cannot be re-recorded. This **supersedes the "exactly 2 demo organizations" wording** in
`10-requirements.md`, `20-feature-organizations-and-users.md` and `40-test-strategy.md`: the two
fixture organizations keep that shape; the three verticals are additional demo data. Read Only
accounts are seeded in every organization (they already were; the specs' "no Read Only account"
wording was stale).

---

## 2026-10-04 — The sign-in pitch shows the product, not the primary colour

**Decided by the user**, choosing option C of `SPEC/mockups/comp-login-alternatives.html`. The auth
screens' left band was filled with the theme's primary; in Graphite, the default, that put a
full-height block of bright amber beside a near-black form. The band now sits on the theme's
**sidebar ground** with a hairline border and the sidebar's own text pair (the rail is dark in Sera
and Graphite, light in the others, so the page's foreground would vanish on Sera's), the primary is
kept for the mark and the Sign in button, and
**Sign in** adds a decorative **schematic board** (five lanes in status hues, placeholder cards,
every colour a theme token). Register and the forced password change share the band without the
board. The copy is unchanged.

---

## 2026-10-04 — Users create boards; managing them stays Org Admin

**Decided by the user**: everyone above Read Only in an organization may add ideas and boards. Ideas
already worked that way. For boards, a **User** may now **create** one in their own organization;
**editing, archiving, unarchiving and reordering lanes stay Org Admin only**. Creating includes
the new board's first choices — its name, description, lanes and the user-moves setting — so a User
makes those once, at creation; changing them afterwards is the Org Admin's. Read Only is refused as
before. A Site Admin still creates boards and ideas only through View As (rule 25 stands; the user
confirmed it the same day).

The permission matrices in `05-product-definition.md` and `10-requirements.md` split *Create/manage
boards* into *Create boards* and *Edit, archive and configure boards*. `contracts/boards.md` names no
roles for the create route, so it is unchanged. The golden corpus recorded `boards.create.user` as
403; it is now 201. The replay will report it as a status difference, and that is
the intended record: `tools/golden/src/accepted.ts` refuses entries that excuse a status, because
an authorization outcome must never be waved through silently.

---

## 2026-10-04 — One Enter adds a tag on the idea form

**Decided by the user**, after typing a new tag, pressing Enter once and being refused on save.
Slice 148 made Enter on unmatched text only *highlight* the *Create tag ‘…’* option, with a second
Enter (or a click) to choose it; a highlighted option looks chosen, so the text stayed in the box
and the save refused it. Now **Enter adds the highlighted option, or the first one when nothing is
highlighted** — an existing tag when one matches by prefix, otherwise *Create tag* — as a chip at
once. The save still refuses text left in the box (the owner's slice 148 decision stands), and its
message now says to press Enter to add it or clear it.

---

## 2026-10-04 — Graphite is the default theme

> Supersedes in part 2026-09-27 "Terrazzo is the palette, with a theme picker" and 2026-09-28
> "Graphite replaces Notte as the dark theme", both of which kept Terrazzo as the default.

**Decided by the user.** The app's default theme is **Graphite**, the dark theme, instead of
Terrazzo. A browser with no `collega-theme` cookie (or one the app does not recognise) is served
Graphite on the first render; a browser that picked a theme in the picker keeps it, since the cookie
is written only by a choice. The five themes, the picker, the per-browser cookie and the 4.5:1 rule
are unchanged.

Terrazzo stays the bare `:root` in `packages/design-system/src/globals.css`: the app always sets
`data-theme`, so the bare block is only what a document with no attribute gets — the comps, and
`global-error.tsx`, which deliberately renders without the design system. Moving the bare block
would change every comp's reference rendering for no product gain. The comps' own pickers still open
on Terrazzo; they are review artefacts, not the app.

---

## 2026-10-04 — Fieldsets: reusable groups of fields, attached to idea types

**Decided by the user.** An Org Admin groups existing custom fields into a named **fieldset**, and an idea
type selects individual fields *and* fieldsets. This **supersedes the 2026-08-10 model note** in
`SPEC/20-feature-idea-type-fields.md` that dropped the reusable "Field Set" entity in favour of direct
type-to-field mapping (that rewrite predates this log and was never an entry here, so it is marked
superseded where it lives: the two feature specs and the contract).

- **Live references.** A type points at a fieldset; it does not copy it. Editing a fieldset changes
  every type that uses it, at once.
- **Effective order** (`SPEC/20-feature-idea-type-fields.md`, "Effective-field resolution"): the type's
  direct fields in their order, then each attached fieldset in its order with its members in their
  order. A field reached twice appears once, at its first position; a direct field wins over a
  fieldset and keeps its per-type required flag. A fieldset-sourced field uses the field's global
  `is_required`. There is no per-set required override.
- **Mode.** `Curated` when the type has any direct field or any attached fieldset, otherwise
  `AllActiveFields`. A type whose fieldsets resolve to no active field stays `Curated`.
- **Soft-deleted or inactive fields** are skipped by the resolver; the membership row survives.
- **Deleting a fieldset is refused with `409` while any type uses it**; the UI shows "Used by N types".
- **Detaching a fieldset** hides its fields and stops validating them; stored `idea_field_values` are
  kept, as with any Curated edit today.
- **Names** are unique per organization, case-insensitively.
- **Permissions** as field definitions: an in-scope Org Admin writes, members read, a Site Admin acting
  directly is refused with `403`.

**The S0.2 schema freeze is amended a sixth time.** Under the 2026-09-11 rule — the freeze stands, and
each change to `schema.prisma` needs its own entry here — this is that entry, and not a general licence.
Additive, no backfill:

- **New table `fieldsets`** (`id`, `organization_id`, `name`, `normalized_name`, `description`,
  `display_order`, `created_at_utc`, `updated_at_utc`, `created_by_user_id`, `updated_by_user_id`),
  unique on (`organization_id`, `normalized_name`), indexed on (`organization_id`, `display_order`).
- **New table `fieldset_fields`** (`id`, `fieldset_id`, `field_definition_id`, `display_order`), unique
  on (`fieldset_id`, `field_definition_id`), indexed on `field_definition_id`; `ON DELETE CASCADE` from
  `fieldsets`, no action from `field_definitions`.
- **New table `idea_type_fieldsets`** (`id`, `idea_type_id`, `fieldset_id`, `display_order`), unique on
  (`idea_type_id`, `fieldset_id`), indexed on `fieldset_id`; `ON DELETE CASCADE` from `idea_types`, no
  action from `fieldsets` (which makes the delete refusal a database guarantee too).
- **Not covered:** a per-set required override, fieldset soft delete, and nested fieldsets.

**Golden corpus.** Idea-type reads and effective-field items gain additive keys (`fieldsetIds`,
`fieldsets`, `source`), and the fieldset routes are new, so the replay may differ there. The backend
slice checks whether `tools/golden/src/diff.ts` tolerates additive keys and records anything else in
`tools/golden/src/accepted.ts`. The corpus is not re-recorded.

Contracts: `SPEC/contracts/fieldsets.md` (new) and `SPEC/contracts/idea-type-fields.md`.

---

## 2026-10-01 — The Home comp is a visual guide; the spec wins

**Decided by the user**, amending "The Home dashboard comp is approved as drawn" below:
`SPEC/mockups/comp-r-home-dashboard.html` is a visual guide, and where it differs from
`20-feature-client-ui.md` § Home the spec wins — in particular *every number is a filtered query the
viewer can open*, showing the same set it counts, and every KPI tile carries a one-line definition.
Slice 156 aligns Home with that:

- **Assigned to me** and **You created** open `/ideas?scope=assigned` and `/ideas?scope=created`, in
  either phase as they count; Assigned's critical share opens `scope=assigned&priority=Critical`, and
  the Assigned panel gains a *View all*. `/ideas` reads `scope` and `phase` from the URL and shows
  them as removable toolbar chips.
- **Critical & high** and the queue's *View all* add `phase=Ideas`, so the list no longer includes
  Issues the count leaves out.
- **The greeting's ideas** are the live boards' own counts, so an archived board's ideas are not
  counted beside "0 boards", and the number opens `/ideas?phase=Ideas` (naming the live boards when one
  is archived). Its boards open `/boards`.
- **The greeting's delivery issues** are every Issue (`/ideas?phase=Issues`), which it links to. This
  replaces the earlier entry's "in flight" figure (backlog plus Planned and Active sprints), which no
  list shows; the words "in flight" go. The sprint panel's backlog figure links to the Backlog.
- **The *Not tracked yet* tile** says in one line why its three figures are not counted.
- **Site Admin:** *Ideas* is the live boards' counts, and the delivery issues every Issue, in each
  organization, matching the member view. *Boards* and *Ideas* stay unlinked: no screen lists them
  across organizations for that role, so they cannot meet the rule until one exists.

- **Archived boards (decided by the user, answering slice 156's open question):** ideas on archived
  boards are left out of every idea figure on Home — the queue, Critical & high, Most upvoted, Assigned
  to me, You created and the critical share — and when any board is archived each link names the live
  boards (`board=`), as the greeting's does, so every count still matches its list.

The earlier entry's other answers stand.

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
