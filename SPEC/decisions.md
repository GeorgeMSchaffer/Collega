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
| 2026-10-16 | Board References UI: lock, task drawer, lane auto-create, metric display, Outcome totals | active | full below |
| 2026-10-16 | Board References follow-ups: auto-create on every entry, tasks not pullable, task editing, metrics on archived boards, Site Admin detail metrics | active | full below |
| 2026-10-16 | Metric types are an organization table with projected and realized values per item | active | full below |
| 2026-10-16 | A reference lane locks its card until its tasks are final | active | full below |
| 2026-10-15 | Cutover follow-up: migration check, SITE_ADMIN_PASSWORD, App Admin in the README, rollback wording | active | full below |
| 2026-10-15 | The 17 open Outcome contract questions are decided | active | full below |
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

## 2026-10-16 — Board References UI: lock, task drawer, lane auto-create, metric display, Outcome totals

> Amends: "A reference lane locks its card until its tasks are final" (2026-10-16), whose bulk-move behaviour into a hand-off lane, refusal texts and UI are settled here; "Removing a lane moves its ideas" (2026-09-29), whose silent skip of a card that left the lane (`contracts/boards.md`) no longer holds when the target is an `autoCreateTask` lane; and "Metric types are an organization table..." (2026-10-16), whose display and Outcome totals are fixed here. Everything else in those entries stands.

**Decided by the user.**

1. **Bulk-move race.** A board save whose `ideaMoves` targets an `autoCreateTask` lane is refused as a whole, `400` keyed `ideaMoves`, "'{title}' is no longer in that lane.", if any planned card is no longer in its `fromStatusId` at commit. Moves into ordinary lanes keep the silent skip. Already built in slice 246.
2. **Refusal texts** (backend already uses them): status move "'{title}' is waiting on {n} open tasks, so it cannot be moved."; detach "'{title}' is waiting on {n} open tasks, so it cannot be removed from the board."
3. **Lock UI.** A locked card cannot be dragged; other lanes do not accept the drop, with a "Waiting on N tasks" tooltip. "Remove from board" and the card's row in another board's pull picker are disabled up front with the same text. An Org Admin gets "Move anyway" or the override from the same places (the card menu, a separate override item next to the disabled "Remove from board", the picker row), never by drag. The override dialog's confirm button is disabled until a reason is typed, so there is no empty-reason error. The activity entry is meant to show the reason verbatim: "Moved past 3 open tasks — <reason>", with who and when (the audit event already stores it; see the consequence on an activity read).
4. **Task drawer.** Status changes from the drawer (the idea status select, honouring the board's `allowUserStatusUpdate`) as well as by dragging. A non-author User sees it read only. A task has its own item key (IMPL-48).
5. **Lane auto-create switch.** Removing the lane's board reference turns auto-create off, with the inline note "Auto-create turned off — it needs a referenced board.", saved in one step. Turning it on leaves cards already in the lane alone; the helper says "Cards already in this lane are not changed."
6. **Metric values.** The unit always follows the number ("12,500.00 $", "120 h"). Display uses the browser locale's thousands separator; input takes digits, one ".", a leading "-", and strips typed commas. The unit-change warning "Existing values are not converted." shows inline while a type's unit is edited. "Show archived" on the metric types list is off by default and not remembered. When an idea is in a final lane, the Realized column header is tinted and reads "Realized — enter now"; nothing is blocked. A direct App Admin (Site Admin without View As) sees "Values are visible through View As." in place of the Value section.
7. **Outcome page.** The meter is clipped at 100% with an "over projected" marker when realized exceeds projected; a negative total shows an empty meter and the number in the danger colour; numbers are always exact. A type with only projected values gets a card with an empty meter, "Realized: not yet". The page shows per-idea values: a breakdown under each type card (idea key, title, projected, realized).
8. **Archiving a metric type.** If any items hold values for the type, archiving asks first: "Archive '{name}'? {n} items keep their values; it stops counting in Outcome totals. You can restore it." A type nothing uses archives without asking.
9. **Archived board.** An idea on an archived board shows one line above its Value section: "This board is archived. Values can still be updated."
10. **Empty Outcome.** An Outcome with no metric values shows, to an Org Admin, a "Set up metric types" link to Settings → Metric types; to everyone else, "No values yet — add them on each idea."
11. **Pull picker.** No standing note about tasks. "N tasks are hidden — they stay on their parent's board." appears only when the search would have matched tasks.

**Why.** (1) A card that slips into a hand-off lane without its task defeats the lane's promise, and a whole-save refusal is the only way to avoid that without half-applying a board edit. (2) The texts match the pull sentence. (3) A control the server will refuse is better disabled with its reason than offered and refused; keeping the override off the drag path stops it happening by accident, and a required reason at the button means nothing is audited without one. (4) Status is the field people most expect to change in a drawer. (5) A switch that is on with no reference is an invalid state; saying so inline beats a server error, and leaving existing cards alone keeps the setting predictable. (6) One rule for unit placement and number entry removes the symbol-before-or-after question. (7) Owners reading an Outcome want to see which ideas make up a total. (8) A permanent note is noise for people who never meet a task in the picker.

**Rejected.** Silent skip for a card that left the lane before a hand-off move; letting a locked card be dragged and snapping it back; an override through drag; an empty-reason error; status changeable only by dragging; asking before auto-create clears; converting values on a unit change; remembering "Show archived"; totals only on the Outcome page; a permanent tasks line in the picker.

**Consequences.**
- `contracts/boards.md` (`ideaMoves` rules) and `contracts/ideas.md` (`parentHasOpenTasks`) are amended; the UI section of `20-feature-board-references.md` points here; `comp-t-board-references-decisions.html` is updated to match.
- **Contract additions needed, for later backend slices (shapes not set here):** per-idea projected and realized values for each metric type on the Outcome read (`metricTotals` returns totals only today); a hidden-task count on the pull picker read for the current search; and an activity/audit read for an idea (no route reads audit events today), which the activity entry needs.
- UI work follows the comp once the owner approves it. Still open in the comp: switch placement on the Statuses row.

---

## 2026-10-16 — Board References follow-ups: auto-create on every entry, tasks not pullable, task editing, metrics on archived boards, Site Admin detail metrics

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

## 2026-10-15 — Cutover follow-up: migration check, SITE_ADMIN_PASSWORD, App Admin in the README, rollback wording

**Decided by the user**, from the slice 213 follow-up.

1. **The additive-migrations check is wider.** `SPEC/50-cutover-runbook.md` §1 check 5 and `SPEC/50-vercel-deployment.md` §10 now cover loosened constraints (dropping `NOT NULL`, e.g. `20261013000000_allow_ideas_without_board`) and dropped indexes (e.g. in `20261001000000_add_idea_followers_and_inbox`) that the running code relies on, not only dropped or renamed columns and tables. This release goes onto a fresh production database, so the check passes trivially; the rule stands for later releases.
2. **`SITE_ADMIN_PASSWORD` stays as documented for this release; no code change.** A tracker follow-up records stopping the API's runtime requirement for it (`apps/api/src/common/config/fragments/site-admin.ts` reads it via `required()`; only the build-time bootstrap uses it), so it can be removed after first login.
3. **"App Admin" in operator docs only.** `README.md` (demo-credentials table, the `db:bootstrap-admin` row, the staging-database note, the configured-admin footnote) and the tracker's owner-side row say App Admin where they describe the UI role. Env var names (`SITE_ADMIN_*`), the `SiteAdmin` role value, log strings, API error text, `SPEC/20-*` feature specs and contracts are unchanged (consistent with 2026-10-04).
4. **Rollback wording follows the runbook.** Code rolls back (the previous deployment keeps serving; repointing `DATABASE_URL` at the old database is the database swap's rollback); the database does not roll back with a code rollback. `SPEC/50-vercel-deployment.md` §10 no longer says "the rollback unit is the database".

---

## 2026-10-15 — The 17 open Outcome contract questions are decided

> Supersedes in part: the "defaults proposed and accepted without individual review" paragraph of "Further decisions" in `SPEC/20-feature-board-references.md`, where it differs (listed below). The lines of that section that the owner decided individually are confirmed, not changed.

**Decided by the user**, on the 17 questions `SPEC/contracts/outcomes.md` ended with. The answers were aligned with `SPEC/20-feature-board-references.md` where it had decided individually (Q1, Q4, Q10, Q12). The contract carries each rule in its route section and lists the 17 under "Decided 2026-10-15", numbered as before.

**Confirmed from board-references (decided there individually):** Q1 the Board References rollup (`ideaCount`/`doneIdeaCount` with an item in a final lane done, `taskCount`/`doneTaskCount` over child cards, projected and realized totals per metric type, `sprintStart`/`sprintEnd` from the tasks' sprints, `null` when none; quarter placement and State computed by the client); Q4 names may duplicate, no uniqueness constraint; Q9 grouping saved per item with `PUT /ideas/{id}/outcomes`, the Outcome write carries no item list and accepts `color`; Q10 a Site Admin is refused on every Outcome route, reads included, and reads only through View As (2026-10-04); Q12 scope: any item with no parent, in any status, on any board, standalone child-board cards included, a card with a parent is a `422`; Q17 appended at the end of the order; Q2 the roadmap read is one `GET .../roadmap` beside the list and detail reads, as the default had it (only the shape is new: no Issue key, `{ outcomes, ungrouped }`); Q3, Q5, Q14 and Q15 confirm the old defaults (Q3 plus the key naming).

**Superseding board-references' unreviewed defaults:** Q6 the list is paged (`page`, `pageSize`, default 20, clamped 1-100), the roadmap read is not; Q7 reorder body `{ "orderedIds": [...] }`, partial allowed, `sortOrder` renumbered `0..n-1`, bad ids a `400` (not `outcomeIds` matching exactly); Q8 reorder is `204` (create `201`, update `200`, delete `204`, grouping `200` + `{ ideaId, outcomeId }`); Q11 fuller audit payloads (Created/Deleted carry the fields, Updated carries old and new per changed field and is written only on change, grouping carries item and from/to ids and names), a no-op writes nothing, no notifications; Q13 `ownerUserId` only, no `ownerDisplayName`; Q16 a repeat `DELETE` of a deleted Outcome of the organization is `204` (never existed or other organization: `404`); grouping into an unknown, soft-deleted or other-organization Outcome is a `400` on `outcomeId`, not `404`.

**Also decided:** Q3 shared validation templates and camelCase keys, shared `403`/`404` text; Q5 colour as tags (upper-case, random on create when absent or `null`, unchanged when absent on update, `null` on update a `400`); Q14 dates `YYYY-MM-DD`; Q15 soft-deleted Outcomes excluded from every read and from grouping, no restore.

**Why.** The Outcomes backend was blocked on these answers (`SPEC/implementation-agent-tracker.md`); recording them lets the backend slice build against a closed contract.

**Consequences.**
- **No schema change from this slice:** names may duplicate, so there is no index and no freeze amendment (Board References was the ninth; this adds none).
- Q1's metric-type totals are flat on the Outcome, but their property shape waits for the metric-types contract.
- The Outcome write carries no item list; the web client sends one grouping `PUT` per changed item.
- `SPEC/20-feature-issues-and-delivery.md` and `SPEC/30-Contracts.md` gain pointers only.

---
