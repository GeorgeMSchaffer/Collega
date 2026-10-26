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
| 2026-10-26 | A board can be Restricted to named users and groups | active | full below |
| 2026-10-26 | An MCP server lets members' AI clients read their organization's data; Auth0 is the authorization server | active | full below |
| 2026-10-25 | A Sprints page shows every sprint in three columns (Upcoming, Ongoing, Completed) | active | full below |
| 2026-10-22 | Anyone who can edit a task may schedule it into a sprint | active | full below |
| 2026-10-22 | Sprint 17 as built differs from comp W in a few places | active | full below |
| 2026-10-22 | The legacy Sprint board lists only cards with a delivery status | active | full below |
| 2026-10-22 | A card on a referenced board is a task on read; a 403 can carry a field key | active | full below |
| 2026-10-22 | Tasks get a Backlog and sprints are planned from it (five surfaces) | active | full below |
| 2026-10-22 | The whole idea card drags between lanes | active | full below |
| 2026-10-22 | Users always move ideas between statuses | active | full below |
| 2026-10-22 | A board can limit which idea types it takes | active | full below |
| 2026-10-21 | Board key prefixes are derived, not typed | active | full below |
| 2026-10-21 | Analytics runs without a consent banner | Current | Full below |
| 2026-10-21 | Production runs with `COLLEGA_ALLOW_DEMO_SEED` set | active | full below |
| 2026-10-20 | Idea assistant v2: enablement gate passed; the v1 default prompt stays | active | full below |
| 2026-10-20 | Idea assistant v2: the idea type never auto-routes to a board | active | full below |
| 2026-10-20 | Idea assistant v2: starter prompts and the no-board create | active | full below |
| 2026-10-20 | Prompt-eval v2 targets confirmed: 0.85 / 0.85 / 0.75, report-only | active | full below |
| 2026-10-20 | Board tasks record whether the system auto-created them (`ideas.auto_created`) | active | full below |
| 2026-10-19 | Board References UI slice 3: three comp U answers | active | full below |
| 2026-10-19 | "Move anyway" offers a lane picker | active | full below |
| 2026-10-19 | Board References UI: comp U answers | active | full below |
| 2026-10-16 | Board References UI: lock, task drawer, lane auto-create, metric display, Outcome totals | active | full below |
| 2026-10-16 | Board References follow-ups: auto-create on every entry, tasks not pullable, task editing, metrics on archived boards, Site Admin detail metrics | amended | full below |
| 2026-10-16 | Metric types are an organization table with projected and realized values per item | active | full below |
| 2026-10-16 | A reference lane locks its card until its tasks are final | active | full below |
| 2026-10-15 | Cutover follow-up: migration check, SITE_ADMIN_PASSWORD, App Admin in the README, rollback wording | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-15 | The 17 open Outcome contract questions are decided | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-15 | Board References replace the Delivery phase | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-15 | The four open Backlog Add New Issue readings are decided | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-15 | Issues can be added directly from the Backlog | amended | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-13 | Boards can pull in existing items, and ideas can have no board | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-13 | Home gets an Unread notifications panel | amended | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-09 | The S0.2 schema freeze is amended a seventh time, for Outcomes | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | `compare` judges the cases both runs share; none shared is exit 2 | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | The App Admin's sidebar offers Home and Settings only | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | The Site Admin role is shown as App Admin | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | An organization is created with its first Org Admin | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | Three vertical demo organizations join Acme and Blue Harbor | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | The sign-in pitch shows the product, not the primary colour | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | Users create boards; managing them stays Org Admin | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | One Enter adds a tag on the idea form | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | Graphite is the default theme | active | [2026-10-04 to 2026-10-15](decisions/archive-2026-10-04-to-2026-10-15.md) |
| 2026-10-04 | Fieldsets: reusable groups of fields, attached to idea types | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The Home comp is a visual guide; the spec wins | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The follow and inbox questions are answered | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The S0.2 schema freeze is amended a fifth time, for idea followers and read state | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The Home dashboard comp is approved as drawn | amended | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | Following an idea, and an in-app notification inbox | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The View As banner names only the target | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The View As candidate order, and F1 closes | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-30 | What the MVP release includes | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-30 | The prompt-eval thresholds stand, confirmed against the v1 baseline | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-29 | How the cutover is run | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-29 | Board lanes reorder by dragging the header, with buttons as the fallback | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
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

## 2026-10-26 — A board can be Restricted to named users and groups

> Spec: `SPEC/20-feature-board-access-and-groups.md`; contracts: `SPEC/contracts/groups.md` and
> `contracts/boards.md` "Board access". Specified only; nothing is built. Promotes the ideas inbox's
> "Teams and private boards", now deleted from the inbox.

**Decided by the owner (2026-10-26), in an interview, one question at a time.**

- **Opt-in private boards.** A board is *Organization* (every board today, and the default) or
  *Restricted*; only a Restricted board's access list of users and groups decides who sees it.
  Rejected: every board needing grants (a migration and per-board admin for every organization); grants
  that only allow editing on boards everyone sees.
- **Org Admins always see every board**, listed or not, so no board can be orphaned. The board's creator
  also always sees it. A Site Admin in View As sees what the target sees.
- **Groups are managed by Org Admins only** (Settings → Groups); every member can list them.
- **An Org Admin or the board's creator sets a board's access**, the same rule as allowed idea types
  (2026-10-22).
- **A non-member sees nothing**: items on a board they cannot see are left out of every list, count, lane,
  picker and notification, and a direct link answers `404`, not `403`. Rejected: a redacted placeholder
  (it reveals existence and needs a second rendering on every surface).
- **A grant decides visibility only.** What someone can do on the board is still their role. Rejected:
  viewer/editor grants (every edit check would consult grants).
- **Membership is read at request time**, so joining or leaving a group changes access to every board the
  group is on without editing any board.
- **The S0.2 schema freeze is amended for this**: `boards.visibility` and four tables (`user_groups`,
  `user_group_members`, `board_access_users`, `board_access_groups`).

**Why.** The owner asked for access by user or group, so a team change is one edit to a group, not one per
board. Defaulting to *Organization* keeps every current response unchanged until someone restricts a board,
which lets the cross-cutting filter land one surface at a time behind tests.

**Open, not decided here** (listed in the spec): whether a Restricted board shows non-admins who has
access; a public portal targeting a Restricted board, when a portal is specified.

## 2026-10-26 — An MCP server lets members' AI clients read their organization's data; Auth0 is the authorization server

> Spec: `SPEC/20-feature-mcp-server.md`; contracts: `SPEC/contracts/mcp.md`. Specified only; nothing is built.

**Decided by the owner (2026-10-26), in an interview, one question at a time.** This is the explicit ask that
`AGENTS.md` "Explicitly Deferred" requires for OAuth, for *MCP access only*; Entra ID sign-in
(`20-feature-oauth.md`) stays deferred and is a separate thing.

- **Auth0** is the authorization server (a new external service, approved), as a **custom database
  connection**: Auth0 asks Collega to check the email and password, so Collega stays the only place a
  password lives. Rejected: Auth0 owning passwords (two logins, and a Collega reset would not end the Auth0
  session); Collega as an OIDC provider (rebuilds the authorization server Auth0 was chosen to avoid).
- **One Auth0 tenant for every environment, with a database connection per environment.** The owner chose
  this for cost, over the recommendation of two tenants. Auth0 tries only the first enabled database
  connection unless `/authorize` names one, and third-party MCP clients cannot name one, so the production
  connection is promoted to the domain level and is the only one real clients reach; the development
  connection is enabled only on first-party Applications we register (MCP Inspector, our test client), never
  promoted. Real third-party clients are tried in production against a test organization. Consequence: no
  isolated place to try a real client; tenant-wide Auth0 settings are shared. B2C Professional ($240 a
  month at 500 active users) is the plan, settled 2026-10-26 after Auth0's pricing page confirmed custom
  database connections need Professional or Enterprise; the connection behaviour is to be confirmed with
  Auth0 before the first backend slice, with two tenants as the fallback.
- **A new `apps/mcp`**, its own Vercel project on `mcp.collega-ai.com`, HTTP-only like `apps/web`; the API stays
  the only thing that talks to the database and the only validator of a token.
- **Read-only in v1**, the core eight tools. Writes and the Claude connectors directory listing come later
  and are not in this spec.
- **Off by default per organization; an Org Admin turns it on.** Site Admins may connect, read-only, naming
  one organization per call, and only in an organization whose switch is on.
- **Client ID Metadata Documents only** for registration; Dynamic Client Registration stays off until a needed client requires it.
- **Approved dependencies:** `mcp-handler`, `@modelcontextprotocol/sdk` (1.26 or later) and `jose`.
- **Access ends within a call, not within a token's life:** 15-minute tokens, and the API rechecks the user,
  the `SecurityStamp` claim, the organization switch and the connection on every call. An MCP token is
  accepted only on nine marked read routes; every other route refuses it.
- **60 calls a minute per user and 600 per organization**, `429` over; **audit** of connections and one event
  per call, never with query text or content; **user-written text is escaped and labelled** in every result.

**Why.** Peers (Linear, Atlassian) ship remote MCP servers, and members want their own AI to read the boards
and ideas the organization already holds. An authorization server is the large, security-sensitive piece;
buying it keeps that out of Collega, and the per-call recheck keeps revocation in Collega's hands whatever
Auth0 does with a refresh.

**Open, not decided here** (listed in the spec): the Auth0 plan check and how the two connections behave in one tenant; the refresh-claim behaviour; DNS and Vercel setup; UI comps; privacy and terms; audit retention; refresh-token lifetime.

## 2026-10-25 — A Sprints page shows every sprint in three columns (Upcoming, Ongoing, Completed)

> Comps: `SPEC/mockups/comp-x-all-sprints.html` (options A to D), `comp-x-sprint-columns-states.html` (every state of the chosen one). Not yet specified or built; the feature spec and slices come next.

**Decided by the owner (2026-10-25): option D, three columns.** A new **Sprints** page under Delivery lists every sprint on the organization's work boards, grouped Upcoming (state `Planned`), Ongoing (`Active`) and Completed. There is no archived state; Completed is the end state. "Upcoming" and "Ongoing" are the page's wording only; the states and the API keep their names.

- **Sorting.** Upcoming by start date, soonest first; Ongoing by end date, soonest first; Completed by end date, latest first.
- **Overdue and Not started.** A sprint past its end date stays Ongoing with an Overdue chip until it is completed; an Upcoming one past its start date shows Not started. Neither state is derived from dates (`contracts/sprints.md`: Start and Complete are explicit). An Org Admin gets **Complete sprint** on the Overdue card and **Start sprint** on the Not started one; the Complete confirmation names the carry-over (unfinished tasks return to the board's Backlog, done ones stay). Everyone else sees the chip only. Both remain Org Admin only, unchanged.
- **Several Ongoing sprints** are allowed, even on one board (no single-active constraint, `contracts/sprints.md`); the page lists them all.
- **A Completed card opens its board's Sprints tab**, not a new summary page. Upcoming opens the sprint's planning page and Ongoing the Sprint board.
- **Paging.** Completed shows the latest 3, then 10 more per "Show more"; the other two columns load whole.
- **Roles.** Add New Sprint is Org Admin only and shown disabled with its reason for a User and Read Only; Plan reads View for them. A Site Admin acting directly sees "Sprints belong to an organization" (as on Tasks).
- **Cards keep their state chip** even inside a column that repeats it, so a card reads the same in List and search views.

**Why.** A board's Sprints tab lists that board's sprints in no order and the Sprint board shows one, so nothing showed what was coming or what had finished. Three columns answer "what is next, what is running, what is done" at a glance and read like the boards people already use.

**Open, not decided here:** the List and Timeline views drawn in comp X (options B and C) are not part of this decision; whether the page also offers them is for the spec.

## 2026-10-22 — Anyone who can edit a task may schedule it into a sprint

**Decided by the owner (2026-10-22), after Sprint 17 shipped scheduling as Org Admin only.** Supersedes the "sprint creation and assignment stay admin-only" reading of `SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-10 and the Roles line of "Tasks get a Backlog and sprints are planned from it". Reasons: the people doing a task are the ones who know when it fits, and the admin-only gate sent a User who could add a task to an Org Admin to schedule it.

**Rule.** *Can edit a task* is the app's existing task-edit rule (`canAdministerIdeaContent`; "Only the author or an Org Admin can edit this task"): the task's author or an Org Admin of its organization. Read Only never; a Site Admin acting directly never. Whoever can edit a task may put it in a Planned or Active sprint of its board or return it to the backlog: Schedule… in the idea drawer, Add and Remove on the planning page and the Backlog bar, the Tasks page's "Move to sprint", `sprintId` on `POST /boards/{boardId}/tasks` (the creator is the author, so any non-Read-Only member), and `PUT /boards/{boardId}/sprint-assignments`. A bulk request is all or nothing: one task the caller may not edit gives `403` keyed `ideaIds`.

**Unchanged, Org Admin only:** creating a sprint (with or without `ideaIds`), editing, deleting, Start and Complete, "+ New sprint", and the create-sprint picker. The single `PUT /ideas/{ideaId}/sprint` is untouched and stays admin-only for every item, board tasks in any phase included (`contracts/delivery.md`).

**Lane drop.** Needs both rights: edit on the task (it schedules) and the status-move right, which every Org Admin and User has and Read Only never (2026-10-22 "Users always move ideas between statuses", unchanged). Blockers and lane rules apply as before.

**Contracts.** `contracts/sprints.md` and `contracts/ideas.md` were edited as an owner-approved exception to "contracts are read, not edited". Not built when written; the tracker carries the slices.

## 2026-10-22 — Sprint 17 as built differs from comp W in a few places

Slices 322 to 337 built the five comp W surfaces. Where the build departs from the comp, the build is the intent until the owner says otherwise:

- **Board panel:** comp W has no panel screen; the Backlog panel (side column at md and up, bottom sheet below) is a builder design. Without an Active sprint the lanes refuse a drop ("No active sprint.") and the Add button targets a chosen open sprint.
- **Sprint controls are Org Admin only,** including the inline new-task line on the planning page (a `sprintId` on task create needs an admin) and "Schedule…" in the idea drawer (TB-9 names no role; read with TB-10). A User can add tasks only from the Backlog "+ New task", which sends no sprint. *Superseded by the entry above ("Anyone who can edit a task may schedule it into a sprint"): scheduling is open to task editors; creating, starting and completing a sprint stay Org Admin only.*
- **Completed sprints** are reachable read-only from the Sprints list and take no changes; Active sprints have no Complete button here.
- **Drag between the planning page's columns** (an enhancement in the comp) is not built; Add and Remove buttons only. **Blocked chip** (comp 1C) is not built.
- **Read Only** sees no panel and no toggle on the board; the Backlog tab still lists for them without controls.
- **Sprints tab badge** counts non-Completed sprints (the spec does not say).
- **Owner answers 2026-10-22:** bulk assignment notifies followers like a single status move (kept); the item-number burn on a refused multi-item drop into an auto-create-task lane is accepted; the Sprints tab badge stays non-Completed sprints; CSV export of standalone cards shows stored stand-in values (no preference, left as is).
- **Owner wants scheduling to reach beyond Org Admin:** a user who can edit a task (its idea's owner) may schedule it. This **supersedes** the Org Admin only reading above and TB-10; not built yet. It needs the spec, `contracts/sprints.md` (`sprint-assignments`, `sprintId` on task create) and the web gating changed together, as a follow-up slice.

## 2026-10-22 — The legacy Sprint board lists only cards with a delivery status

`/delivery/sprint` threw on a sprint holding a work-board task: `GET /delivery?sprintId=` returns a board sprint's items in any phase (`contracts/delivery.md` "A board sprint"), and a task has no delivery status or effort. **Rule:** the web reader `getIssuesInSprint` drops cards whose `deliveryStatus` is `null` before adapting them; tasks are shown on their board's Sprints tab and planning page. The API keeps returning them (pinned by the board-sprint QA tests, and the sprint's `issueCount` counts tasks by design), and `toIssue` keeps throwing for a real Issue missing a status or effort. The Backlog and issue-page readers cannot leak: they read Delivery-phase items only.

## 2026-10-22 — A card on a referenced board is a task on read; a 403 can carry a field key

**Decided by the owner (the first part), slice 322.** `POST /boards/{boardId}/tasks` without a parent makes a standalone card. It is stored as an ordinary item row, so it keeps the stand-in priority, type, business impact and problem text that a task never shows. **Rule:** a card on a board that a non-archived board's lane references (the same test as `boardIsNotAWorkBoard`) is a task on read, parent or not. Priority, type, business impact, problem, solutions, impact rationale, effort and metrics are hidden on the list and detail reads, and the card is edited as a task. No schema change. The CSV export still writes the stored values for such a card; to be revisited if it matters.

**Keyed 403.** A refusal that is about one field of the request (a non-admin sending `sprintId`) is a `403` whose problem body also carries `errors: { sprintId: [...] }`. In code, `ForbiddenError` takes optional `failures`, and the problem-details filter renders them as `errors`. No other 403 changes. **Keyed 422 (slice 324).** `UnprocessableError` likewise takes optional `failures`, rendered as `errors` on a 422 only when set (`detail` stays the code); the per-item refusals of bulk sprint assignment and create-with-tasks key `ideaIds` with a message that starts with the item key. Other 422s unchanged.

## 2026-10-22 — Tasks get a Backlog and sprints are planned from it (five surfaces)

> Extends `SPEC/20-feature-board-references.md` (tasks, per-board sprints); changes none of its rules. Spec: `SPEC/20-feature-task-backlog-and-sprint-planning.md`. Comps: `SPEC/mockups/comp-w-tasks-and-sprint-planning.html`, `comp-w-alternates-tasks-and-sprint-planning.html` (review comps; the spec governs).

**Decided by the owner.** Tasks have no home outside their parent idea's drawer, and a sprint cannot be filled from waiting tasks. Build **all five** approaches, as slices over one pair of lists (unassigned tasks, a sprint's tasks):

1. A **Backlog tab** per work board (default) with "+ New task" and an "Add to sprint" bulk bar; the same list is a **collapsible panel** beside the lanes (a toggle, not a second build).
2. The **create-sprint** drawer ends with a picker of the board's unassigned tasks; creating with tasks is atomic.
3. A **sprint planning page** (backlog beside the sprint).
4. A **Tasks page** across work boards, with "Move to sprint" for one board's selection.
5. A **Schedule…** step in the parent idea's Tasks section.

Rules settled with it:
- **A lane drop sets status.** Dropping a backlog task on a lane puts it in the Active sprint and sets its status to that lane, through the board's own move, so blockers and lane rules still apply and a refusal leaves it in the backlog. The **Add** button adds to the sprint and leaves status alone. With no Active sprint a panel drop is refused.
- **Roles.** Users add tasks (standalone or parented); only Org Admins create sprints and assign tasks to them (`contracts/sprints.md` is unchanged). Read Only sees, no controls.

**Why.** A task is a card on a board but only reachable through its parent, so standalone and cross-idea tasks cannot be managed; and sprint creation, which the person experiences as "plan the next two weeks", had no step for choosing the work. One list serving five entry points avoids five models.

**Build needs** (contracts written 2026-10-22, owner to review, in `contracts/sprints.md` and `contracts/ideas.md`): `ideaIds` on board sprint create, `PUT /boards/{boardId}/sprint-assignments` (bulk, atomic, optional `statusId`), `hideFinal` and the org list's `sprintId`, and `POST /boards/{boardId}/tasks`. The sprint field on board items and the single assignment route already existed; no cross-board task route is needed.

**Tasks page choices (slice 334, 2026-10-22, builder's calls for owner review).**
- Backlog and My tasks hide finished work; In sprint and All show it.
- In sprint is one request per open sprint, merged; Completed sprints are excluded (the API has no any-sprint filter).
- "Move to sprint" only; no return to backlog from this page.
- The first 100 newest rows, no filters or paging.
- No Blocked chip, unlike comp W screen 1C: the Tasks table does not know each board's first lane.
- The "Tasks" nav entry follows Ideas, hidden from a Site Admin acting directly.

## 2026-10-22 — The whole idea card drags between lanes

**Decided by the owner.** On board lanes a pointer drag anywhere on an idea card moves it to another
lane; until now only the small grip handle started a drag.

- **Why.** A live report said drag between lanes did not work. The handle drag did; people grab the
  card body, and the handle was too small to find.
- **What stays.** A card drags only under its arrows' rule (`canMove`) and never while a reference
  lock or blocker holds it (the lock icon says why). A press that does not travel is still a click,
  so the title, upvote and arrows keep working; once a drag starts the browser sends no click. The
  drag image is the card, and ← → on the focused title still moves it one lane.
- **Supersedes** the "dedicated drag handle; interactive controls never start a drag" rule in
  `05-product-definition.md`, `10-requirements.md`, `20-feature-client-ui.md`,
  `20-feature-ideas-and-engagement.md` and `40-test-strategy.md`, each now carrying a dated note.

## 2026-10-22 — Users always move ideas between statuses

**Decided by the owner.** The board setting *Let Users move ideas between statuses on this board*
(`allowUserStatusUpdate`) leaves the UI, and a User may always move an idea between statuses on a
board they can write on. Read Only still never may, and an archived board still moves nothing.

- **Why.** The setting was rarely wanted and made a User's board behave differently from board to
  board for no visible reason; the role already says who may write.
- **What changes.** The board form, the board drawer and the Settings boards list no longer show it.
  The client sends `allowUserStatusUpdate: true` on every create and update, the quick-add row
  included (it sent `false` since 2026-10-15). `IdeaService` no longer reads it when a User changes
  an idea's status, and the web move gates follow the role and the archived state only.
- **What stays.** The `boards.allow_user_status_update` column, the contract field and the domain
  and API fields are kept for now: the schema is frozen, and a later change drops them.

Rule 16 of `20-feature-boards-and-statuses.md`.

## 2026-10-22 — A board can limit which idea types it takes

**Decided by the owner** (four answers, 2026-10-22). Reopens the "no per-board setting" clause of
"Idea assistant v2: the idea type never auto-routes to a board" (2026-10-20) for **restriction
only**: a type still never chooses a board.

- **Who.** An Org Admin of the organization, or the board's creator (`boards.created_by_user_id`)
  while they are an active User or Org Admin there. A Site Admin only through View As. The creator
  right covers this setting only; the rest of the board stays Org Admin only.
- **Empty means all.** A board with no types selected takes every active type, which is every
  board today, so nothing is backfilled. Narrowing the list leaves ideas already on the board
  alone, with the type they have.
- **Where it bites.** Creating an idea on the board, changing an idea's type while it is on the
  board, and moving or pulling an idea onto the board. The form lists only the allowed types; an
  idea already on the board keeps showing its current type, marked as not allowed. A type the
  assistant detects is used as the form's default only if it is allowed.
- **Idea features off.** The setting is hidden and ignored while `idea_features_enabled` is off, so
  reference boards and auto-created tasks are never blocked.
- **Schema.** The S0.2 freeze is amended a twelfth time: `board_idea_types` (`board_id`,
  `idea_type_id`, primary key on the pair, cascade on board delete).

- **Details** (owner, same day): the board read carries a server-computed `canSetAllowedIdeaTypes`; a change is audited as `BoardUpdated` with `allowedIdeaTypeIds` in its metadata, not a new event; a CSV row of a disallowed type is refused on its own and the rest import.
- **Later the same day** (owner): the admin-only reassign-type route is limited too, with no override; and an archived type drops out of the list, so a list holding only archived types counts as empty and the board takes every type.

Contracts: `contracts/boards.md` "Allowed idea types" and the create, update and pull errors in
`contracts/ideas.md` and `contracts/boards.md`. Rule 15 of `20-feature-boards-and-statuses.md`.

## 2026-10-21 — Board key prefixes are derived, not typed

The board form no longer asks for a key prefix. A new board's prefix is derived from its name (initials, numbered on a clash, `deriveKeyPrefix` in `packages/domain/src/boards/board.ts`), so people can't mistype or collide one. The API still accepts an explicit prefix and the change rule (`422 keyPrefixLocked`) still holds, so existing boards are unchanged. Revisit if people need to choose a key.

## 2026-10-21 — Analytics runs without a consent banner

Vercel Analytics is used for page views and a small set of custom events (`SPEC/20-feature-analytics.md`).
It sets no cookies, and the events carry no identifiers or personal data, so there is no consent
banner. Revisit if an event ever needs a user identifier, or if analytics gains a cookie or a
third-party script.

## 2026-10-21 — Production runs with `COLLEGA_ALLOW_DEMO_SEED` set

Decided by the owner at cutover: the production `collega-api` deployment keeps
`COLLEGA_ALLOW_DEMO_SEED=true`, because the demo is loaded from it today. This supersedes
`SPEC/50-cutover-runbook.md` §1, which said the variable must be unset in production, and its
first-day check that it is unset at the end of the day. Consequence: the App Admin can seed and
reset demo data in production, and a reset drops what is there. Revisit before the first real
tenant is loaded.

## 2026-10-20 — Idea assistant v2: enablement gate passed; the v1 default prompt stays

**Decided.** Slice 311's gate is met. The v2 baseline (`tools/prompt-eval/baselines/v2-default.json`, slice 314) has `refuse-*` recall 20/20, refusal precision 1.00, mapping 0.99, custom fields 1.00, interview order 0.90, "I kept your edit" 1.00 and no surviving locked field, and every v2 target is met. A browser walk against the real model filled the form as Suggested, kept an edited Title and said so, and *Fill out manually* / *Use the assistant* kept the conversation.

**What "enabled" means.** `continueTurnV2` already sends `SYSTEM_PROMPT_TEMPLATE_V2` on every v2 turn, so there is nothing to switch on. `SYSTEM_PROMPT_TEMPLATE` is **not** promoted: it stays the v1 text, which the v1 baseline, the v1 eval cases and the advisory prompt probes still measure. Promoting it would invalidate all three for no behavioral gain.

**Why not promote.** The stored prompt versions and "reset" are v1 text and are never sent on a v2 turn, so changing the default only moves what the v1 tooling sees.

## 2026-10-20 — Idea assistant v2: the idea type never auto-routes to a board

**Decided by the owner.** Supersedes the "type picks the board" clause of the entry below. A detected Idea Type only **defaults the form's type** (Suggested, per 306/309); it never chooses a board. The person picks the board; a board-less create stays in the pool/backlog. No schema change, no per-type or per-board routing setting. Reopen only if admins ask for type-based routing.

> Amended 2026-10-22 ("A board can limit which idea types it takes"): a per-board *restriction* now exists. Routing is still never automatic.

---

## 2026-10-20 — Idea assistant v2: starter prompts and the no-board create

**Decided by the owner** (slice 308 review follow-ups).

- **Starter prompts:** the chat's starters are drawn in the long run from the organization's recent idea titles and descriptions. The fixed examples stay alongside them for now; the org-derived ones are a later slice, not 308.
- **Ideas created without a board:** the assistant starts the idea in the pool/backlog by default. Once it can detect an idea type, the type picks the board (and defaults the form's type, per the 306 decision); if no type is detected the idea stays in the pool/backlog. Slice 309 or 307 wires the turn route for the board-less case; the contract needs an org-level variant or a deferred board id, to be settled in that slice.

---

## 2026-10-20 — Prompt-eval v2 targets confirmed: 0.85 / 0.85 / 0.75, report-only

**Decided by the owner.** The v2 targets proposed in slice 305 are confirmed at a looser level than proposed (0.90 / 0.90 / 0.80): v2 refusal precision **0.85**, v2 overall mapping accuracy **0.85**, each v2 group (structured fields, interview order, brainstorm suggestions, custom fields, "I kept your edit") **0.75**, on the point estimate.

- Still report-only: met or not met in the summary, never an exit code. What gates a v2 run is unchanged: the `refuse-*` recall floor (rule 31), a surviving locked field (rule 16), and a regression against a baseline (rule 32).
- Why looser: no v2 run exists yet, groups are small (a few trials each), and the v1 baseline's 0.95 was measured on a much larger corpus. Tighten once a v2 baseline shows real rates.
- Lives in `tools/prompt-eval/src/v2-targets.ts` and runner spec rule 33.

---

## 2026-10-20 — Board tasks record whether the system auto-created them (`ideas.auto_created`)

> Resolves the "Not yet returned: `autoCreated`" note on `GET /ideas/{ideaId}/board-tasks` (`contracts/ideas.md`).

**Decided by the owner.** The S0.2 schema freeze is amended an eleventh time with one additive column, `ideas.auto_created boolean not null default false`, and the board-task read returns it as `autoCreated`. This is a contract change the owner approved (slice 303).

- `true` exactly where a card entering an `autoCreateTask` lane gets its task: the move route, a pull, and a bulk lane move (all three go through one staging path in `IdeaService`). `false` for `POST /ideas/{ideaId}/board-tasks`, for every ordinary idea, and for rows that existed before the migration; no backfill.
- Returned only on the board-task list. Idea reads and the board and organization lists do not carry it.
- Comp U's quiet "auto-created" tag (screen 4, frames A and D) shows on a task row when it is true.

Why a column: nothing stored told the two apart (both audit as `BoardTaskCreated`), and deriving it from audit rows would make a read depend on the audit table.

---

## 2026-10-19 — Board References UI slice 3: three comp U answers

> Answers three open questions on comp U screen 4 (Tasks section).

**Decided by the user.** (1) Opening a task from the parent drawer's list **goes to the Implementation board** (the task's own board, with the task's drawer open); no second drawer is stacked on the parent's. (2) **Read Only does not see "+ Add task"**; the section shows the list alone. (3) **A task can be removed from its parent** from the Tasks section.

Why: stacking drawers leaves two unsaved edit states and a back-stack nobody asked for; the board is where a task's lane, sprint and blockers are already shown. Hiding rather than disabling matches how Read Only is treated on the rest of the page. Removal is needed so a task added by mistake does not strand its parent behind the lock.

**Open from (3), for the backend slice:** "removed" is not defined by the specs. Detach (task becomes a standalone card) or delete? Slice plan assumes delete of the task card, which also drops its blocker links in both directions; confirm before building.

---

## 2026-10-19 — "Move anyway" offers a lane picker

> Amends: "Board References UI: lock, task drawer, lane auto-create, metric display, Outcome totals" (2026-10-16), item 3, which gave an Org Admin "Move anyway" without naming a target lane.

**Decided by the user.** The Org Admin override on a locked card (the board card and the arrow-key path) opens a dialog with a **lane picker**, defaulting to the next lane (the previous lane at the end of the board), and the required reason. An admin may force a card to any lane of the board, not only the neighbouring one. The picker lists the board's lanes in order, excluding the card's current lane. The reason stays required and is audited as `IdeaMovedPastOpenTasks` with the open-task count, as before; no server change is needed, since the move route already takes any `statusId` with `forceReason`.

Why: slice 293 shipped the override with a fixed target because the comp named none, which meant a card in the first lane could never be forced straight to a later lane. The server rules still apply to the chosen lane (for example `effortRequiredForReferenceLane` for a reference lane, and `taskBlocked`, which has no override).

**Build:** a small follow-up to Board References UI slice 3, in `apps/web/components/ideas/move-anyway-dialog.tsx`.

---

## 2026-10-19 — Board References UI: comp U answers

> Amends: "Board References follow-ups: auto-create on every entry, tasks not pullable, task editing, metrics on archived boards, Site Admin detail metrics" (2026-10-16), and through it "A reference lane locks its card until its tasks are final" (2026-10-16), whose rule that every entry creates one task is limited to the first entry (answer 5); and the 2026-10-15 Board References entry's Effort rule, which gated entry only (answers 2 and 6). Everything else in those entries stands.

**Decided by the owner**, on the open questions in `SPEC/mockups/comp-u-board-references-core.html`.

1. **A Final lane cannot reference a board.** Saving a lane with `isFinal` true and `referencesBoardId` set is `422` `finalLaneCannotReference`. The Statuses page disables the reference selector (and so the auto-create switch) on a Final lane.
2. **No Effort, no drop target.** On the idea board, a card with no Effort is refused up front on a reference lane: it cannot be dropped there, and the lane shows the tooltip "Add Effort first". No toast follows, so the toast's "Add effort" retry question does not arise. The server rule `422` `effortRequiredForReferenceLane` stays as the backstop (pull, `ideaMoves`, other clients).
3. **The work board's sprint header and chips are in this UI round.** Not deferred. Whether the backend has what they need is checked below.
4. **The blocked badge shows only while the task sits in its first lane.** A blocker added after the task left the first lane is allowed (`contracts/idea-dependencies.md`) and shows no badge.
5. **Moving a card back into an auto-create lane does not create a second automatic task.** Auto-create is skipped when the idea already has at least one task on the referenced board (any lane, final or not); the first entry, with no task yet, creates one. This holds on every path: status move, pull (`pullItemIds`) and `ideaMoves`. Adding a task by hand stays possible (the "Move back to <status>?" prompt, then "+ Add task").
6. **Effort in a reference lane can be changed, not cleared.** An idea update with `effort` `null` while the idea sits in a reference lane is `422` `effortRequiredInReferenceLane`. Also corrected: effort may be set at any time. The Discovery-only wording in `contracts/ideas.md` dates from the removed phases.
7. **A blocked card cannot be dragged out of its first lane.** Up front, like the lock and the no-Effort rule: no drop target on other lanes, and a tooltip that names the blocker. The server rule `422` `taskBlocked` stays as the backstop.

**Why.** (1) A card in a Final reference lane would sit done and locked at once; the combination has no use. (2, 7) One refusal style for every rule the client can see coming: no drop target and a reason, never a drop that bounces. (4) A badge on a card that can no longer be blocked from moving is noise. (5) The lane's promise is a first task, not a task per visit; moving back for a late task would otherwise add a duplicate the person did not ask for. (6) A card with no Effort in a reference lane breaks the rule that put it there.

**Rejected.** A Final reference lane; a toast after the drop for a missing Effort; retrying the move by itself after Effort is saved; deferring the sprint header; a badge past the first lane; auto-create on every re-entry; clearing Effort in a reference lane.

**Consequences.**
- `contracts/boards.md` gains the Final-lane rule and `finalLaneCannotReference`, and the first-entry rule for auto-create; `contracts/ideas.md` gains `effortRequiredInReferenceLane`, the first-entry rule, the corrected effort text and the client-side refusals; `20-feature-board-references.md` follows; `comp-u-board-references-core.html` shows the answers as decided.
- **Backend follow-up, not yet scheduled:** `finalLaneCannotReference` on the lane save; `effortRequiredInReferenceLane` on the idea update; skipping auto-create when the idea already has a task on the referenced board, on the status move, the pull and `ideaMoves`. Each needs the existing tests for the old behaviour (every entry creates one) revisited.
- **Sprint header and chips: gaps recorded, no contract invented.** `contracts/sprints.md` "Sprints per board" specifies `GET/POST /api/v1/boards/{boardId}/sprints`, `sprintsNotEnabled` and `sprintItemOnOtherBoard`, but is marked planned and "Not built until Plan 2". The header also needs (a) a read that gives each work-board card its sprint (`sprintId`, name) for the chips, which the board idea item does not carry; (b) a way to put a task in a sprint, since the only assignment route, `PUT /ideas/{ideaId}/sprint` in `contracts/delivery.md`, belongs to the Delivery phase being retired; (c) the header's task and idea counts for a board sprint, since `issueCount`/`doneCount` count Issues; (d) the Sprint | Backlog toggle's backlog read. Tracker open item: confirm what Plan 2 built, then specify (a) to (d) before the UI slice.

---

## 2026-10-16 — Board References UI: lock, task drawer, lane auto-create, metric display, Outcome totals

> Amends: "A reference lane locks its card until its tasks are final" (2026-10-16), whose bulk-move behaviour into a hand-off lane, refusal texts and UI are settled here; "Removing a lane moves its ideas" (2026-09-29), whose silent skip of a card that left the lane (`contracts/boards.md`) no longer holds when the target is an `autoCreateTask` lane; and "Metric types are an organization table..." (2026-10-16), whose display and Outcome totals are fixed here. Everything else in those entries stands.

**Decided by the user.**

1. **Bulk-move race.** A board save whose `ideaMoves` targets an `autoCreateTask` lane is refused as a whole, `400` keyed `ideaMoves`, "'{title}' is no longer in that lane.", if any planned card is no longer in its `fromStatusId` at commit. Moves into ordinary lanes keep the silent skip. Already built in slice 246.
2. **Refusal texts** (backend already uses them): status move "'{title}' is waiting on {n} open tasks, so it cannot be moved."; detach "'{title}' is waiting on {n} open tasks, so it cannot be removed from the board."
3. **Lock UI.** A locked card cannot be dragged; other lanes do not accept the drop, with a "Waiting on N tasks" tooltip. "Remove from board" and the card's row in another board's pull picker are disabled up front with the same text. An Org Admin gets "Move anyway" or the override from the same places (the card menu, a separate override item next to the disabled "Remove from board", the picker row), never by drag. The override dialog's confirm button is disabled until a reason is typed, so there is no empty-reason error. The override dialog's body reads: "'{title}' ({key}) is waiting on these tasks. Moving it to {lane} leaves them open on the {board} board." The activity entry is meant to show the reason verbatim: "Moved past 3 open tasks — <reason>", with who and when (the audit event already stores it; see the consequence on an activity read).
4. **Task drawer.** Status changes from the drawer (the idea status select, honouring the board's `allowUserStatusUpdate`) as well as by dragging. A non-author User sees it read only. A task has its own item key (IMPL-48).
5. **Lane auto-create switch.** Removing the lane's board reference turns auto-create off, with the inline note "Auto-create turned off — it needs a referenced board.", saved in one step. Turning it on leaves cards already in the lane alone; the helper says "Cards already in this lane are not changed." The helper under the switch reads: "A card entering this lane gets one task named after it, in the first lane of {board} ({lane}). The card then waits on it." The switch sits on a second line under the lane row and is shown only on lanes that reference a board.
6. **Metric values.** The unit always follows the number ("12,500.00 $", "120 h"). Display uses the browser locale's thousands separator; input takes digits, one ".", a leading "-", and strips typed commas. The unit-change warning "Existing values are not converted." shows inline while a type's unit is edited. "Show archived" on the metric types list is off by default and not remembered. When an idea is in a final lane, the Realized column header is tinted and reads "Realized — enter now"; nothing is blocked. A direct App Admin (Site Admin without View As) sees "Values are visible through View As." in place of the Value section.
7. **Outcome page.** The meter is clipped at 100% with an "over projected" marker when realized exceeds projected; a negative total shows an empty meter and the number in the danger colour; numbers are always exact. A type with only projected values gets a card with an empty meter, "Realized: not yet". The page shows per-idea values: a breakdown under each type card (idea key, title, projected, realized).
8. **Archiving a metric type.** If any items hold values for the type, archiving asks first: "Archive '{name}'? {n} items keep their values; it stops counting in Outcome totals. You can restore it." A type nothing uses archives without asking.
9. **Archived board.** An idea on an archived board shows one line at the top of its Value section, under the heading: "This board is archived. Values can still be updated."
10. **Empty Outcome.** An Outcome with no metric values shows, to an Org Admin, a "Set up metric types" link to Settings → Metric types; to everyone else, "No values yet — add them on each idea."
11. **Pull picker.** No standing note about tasks. "N tasks are hidden — they stay on their parent's board." appears only when the search would have matched tasks.

**Why.** (1) A card that slips into a hand-off lane without its task defeats the lane's promise, and a whole-save refusal is the only way to avoid that without half-applying a board edit. (2) The texts match the pull sentence. (3) A control the server will refuse is better disabled with its reason than offered and refused; keeping the override off the drag path stops it happening by accident, and a required reason at the button means nothing is audited without one. (4) Status is the field people most expect to change in a drawer. (5) A switch that is on with no reference is an invalid state; saying so inline beats a server error, and leaving existing cards alone keeps the setting predictable. (6) One rule for unit placement and number entry removes the symbol-before-or-after question. (7) Owners reading an Outcome want to see which ideas make up a total. (11) A permanent note is noise for people who never meet a task in the picker.

**Rejected.** Silent skip for a card that left the lane before a hand-off move; letting a locked card be dragged and snapping it back; an override through drag; an empty-reason error; status changeable only by dragging; asking before auto-create clears; converting values on a unit change; remembering "Show archived"; totals only on the Outcome page; a permanent tasks line in the picker.

**Consequences.**
- `contracts/boards.md` (`ideaMoves` rules) and `contracts/ideas.md` (`parentHasOpenTasks`) are amended; the UI section of `20-feature-board-references.md` points here; `comp-t-board-references-decisions.html` is updated to match.
- **Contract additions needed, for later backend slices (shapes not set here):** per-idea projected and realized values for each metric type on the Outcome read (`metricTotals` returns totals only today); a hidden-task count on the pull picker read for the current search; and an activity/audit read for an idea (no route reads audit events today), which the activity entry needs.
- UI work follows the comp once the owner approves it.

---

## 2026-10-16 — Board References follow-ups: auto-create on every entry, tasks not pullable, task editing, metrics on archived boards, Site Admin detail metrics

> **Amended 2026-10-19** by "Board References UI: comp U answers": answer 1 (auto-create fires on every entry) now skips an idea that already has a task on the referenced board.

> Amends: "A reference lane locks its card until its tasks are final" (2026-10-16), whose auto-create-on-entry hand-off is widened from the status move to every way a card enters a lane; "Board References replace the Delivery phase" (2026-10-15), which left editing a task and pulling one unspecified; and "Metric types are an organization table with projected and realized values per item" (2026-10-16), whose idea-detail default for a Site Admin and whose silence on archived boards are settled here. Everything else in those entries stands.

**Decided by the user.**

1. **Auto-create fires on every entry.** A card entering an `autoCreateTask` lane by any path gets its one task: a status move, a pull from another board (`pullItemIds`), or a bulk lane move (`ideaMoves` on a board edit). Same transaction as the entry; a failure rolls the whole write back.
2. **Tasks are never pull candidates.** An item with a parent is left out of the pull picker and refused if its id is sent in `pullItemIds`. A task lives on the board its parent's reference lane points to; moving it would break the lock and the rollup.
3. **Tasks are editable, task fields only.** The author or an Org Admin may edit a task's `title`, `description`, `assigneeUserIds` and `tagNames` through `PUT /ideas/{ideaId}`. Idea-only fields are not taken (ignored, as on create) and stay `null` on read; sprint and blockers keep their own routes. Read Only never; a direct Site Admin as for any idea update.
4. **Metric writes stay open on an archived board.** `PUT /ideas/{ideaId}/metrics` is allowed when the card's board is archived. This is a deliberate exception to `20-feature-boards-and-statuses.md` rule 13 (an archived board is read-only), because realized values often arrive after the work is finished and the board archived.
5. **A direct Site Admin gets `metrics: []` in the idea detail.** The metric-types contract's "refused on every route, reads included" wins over the detail returning the array; the Site Admin sees values through View As.

**Why.** (1) The lane's setting is a promise about the lane, not about one route; a card that arrives by pull or board edit would otherwise sit in a hand-off lane with nothing to wait on. (2) A task moved off its board escapes the lock and the rollup, and the picker has no use for it. (3) A task whose title or assignee cannot be corrected forces delete and re-create, losing its key and history. (4) Realized value is the point of the feature and is known last. (5) One reading of the Site Admin rule, with no exception for the detail.

**Rejected.** Auto-create on the status move only (leaves a pull or board edit bypassing the hand-off); letting a task be pulled, with the parent's lock re-checked; leaving tasks uneditable; editing idea-only fields on a task; refusing metric writes on an archived board like every other write; the detail refusing a direct Site Admin with `403`.

**Consequences.**
- `20-feature-board-pull-in.md` (rules 9 and 10, the picker) excludes tasks.
- `contracts/ideas.md` (status move, task update, detail `metrics`), `contracts/boards.md` (`autoCreateTask`, "Pulling items", pull candidates), `contracts/metric-types.md` and rule 13 of `20-feature-boards-and-statuses.md` are amended; `20-feature-board-references.md` follows.
- **Backend follow-up, not yet scheduled:** auto-create on pull and on `ideaMoves` (today only the status move creates the task); the `pullItemIds` refusal and the picker filter for tasks; the task branch of the idea update; the archived-board exception on the metrics write; `metrics: []` for a direct Site Admin.
- QA slice 244's `it.fails` cases, the CSV Idea Type and Business Impact cells, are a defect to fix with that backend work, not a behaviour to keep.

---

## 2026-10-16 — Metric types are an organization table with projected and realized values per item

> Amends: "The 17 open Outcome contract questions are decided" (2026-10-15), whose Q1 left the metric totals' shape to this contract, and "Board References replace the Delivery phase" (2026-10-15), whose board-task create body is narrowed below. Everything else in those entries stands.

**Decided by the user.** A metric type is a row in a new `metric_types` table, owned by the organization and managed by an Org Admin: a name (duplicates allowed) and a free-text unit. Only items with no parent carry values: one projected and one realized number per type, written as a whole set with `PUT /ideas/{ideaId}/metrics` by whoever may edit the item. Realized values are not gated on a final lane. Removing a type archives it and keeps its values. An Outcome returns `metricTotals`, one entry per active type with a value under it. The routes and rules are in `contracts/metric-types.md`.

**Why.** Outcomes span boards, so their totals only line up if types are shared across the organization. A unit is enough to show a number without a format engine. Values on top-level items alone mean a rollup never counts a parent and its tasks twice. Archiving keeps realized history when a type is retired.

**Rejected.** Reusing the user-defined fields machinery (a field holds one value per item, not a projected and realized pair, and is shown on the idea form, not summed); per-board types; a fixed global list; a kind enum (percent does not sum); values on tasks; refusing realized values outside a final lane; unique names.

**Defaults the user may overrule.** Values are decimals with two places, and negatives are allowed. Any member reads the types. A Site Admin works only through View As, reads included. The idea detail read returns `metrics`. The contract's shapes are the assistant's too: name max 80 and unit max 20 characters, `unit` nullable; archive and restore through `PUT` with `isArchived`; a separate `GET /ideas/{ideaId}/metrics` that includes values on archived types, flagged; `?includeArchived`, unpaged, ordered by creation; an unknown type in the body is `400`; an item with a parent is refused with `422` `taskCannotCarryMetrics`; totals skip soft-deleted items and items with a parent; the audit event names; no notification; a unit change does not convert values.

**Consequences.**
- The S0.2 schema freeze is amended a tenth time: `metric_types` (`metric_type_id`, `organization_id`, `name`, `unit`, `is_archived`, timestamps) and `idea_metric_values` (`idea_id`, `metric_type_id`, `projected`, `realized`, unique on the pair). The same amendment carries slice 236's `board_swimlanes.auto_create_task`.
- Slice 233 builds on that schema.
- **Board-task create body (decided by the user the same day):** `POST /ideas/{ideaId}/board-tasks` takes `title` (required), `description`, `assigneeUserIds` and `tagNames`; the idea-only fields are `null` on a task (`contracts/ideas.md`). This replaces "the idea create body, minus `boardId`".

---

## 2026-10-16 — A reference lane locks its card until its tasks are final

> Amends: "Board References replace the Delivery phase" (2026-10-15), whose "Leaving early" rule (leave a reference lane with open tasks, after a warning) is replaced. Everything else in that entry stands.

**Decided by the user.** A card in a reference lane cannot leave it while any of its tasks is not in a final lane. The card shows "Waiting on N tasks". An Org Admin may force the move by giving a reason; it is audited. A lane may also be set to **auto-create one task on entry** (the hand-off): the task takes the card's title and starts in the child board's first lane, and the parent waits on it. With the setting off, people add tasks by hand (fan-out). Entering a lane with no tasks leaves the card unlocked, since there is nothing to wait on. Nesting stays at two boards (idea board → work board). The completion prompt still needs a person to confirm.

**Why.** The owner wants workflows that hand work to other workflows (Trello's flow with Jira's breakdown): a vetted idea runs on a project board whose tasks must finish before the idea is done. A warning on early exit did not express that. A hard lock does, and the Org Admin override avoids the stuck-card failure of strict gates. Fan-out with the lock covers the hand-off case too, so there is one mechanism, not two.

**Rejected.** A travelling card that leaves its board for the child board (two mechanisms, loses the parent's key, Outcome and history); three or more board levels (lock and rollup cost); a lock with no override.

**Consequences.**
- One additive column: `board_swimlanes.auto_create_task boolean default false` (carried by the tenth S0.2 amendment, "Metric types are an organization table...", 2026-10-16).
- New rule and error `parentHasOpenTasks` on moves out of a reference lane; new audit event `IdeaMovedPastOpenTasks`.
- **Every exit is locked (decided 2026-10-16).** The lock also covers leaving the board by detach (`DELETE /api/v1/ideas/{ideaId}/board`) and by being pulled onto another board (`pullItemIds`). Same error, same Org Admin override with a reason, same audit event. Otherwise detach or pull would sidestep it.
- The backend slices already merged (220-232, 234) need a follow-up slice for the lock, the override and auto-create; the UI shows the lock and the lane setting.

---
