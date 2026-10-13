# Feature: Pulling Existing Items onto a New Board, and Ideas with No Board

> **At a glance** (added 2026-10-13; the text below wins where they differ)
> - **Scope:** when a board is created or edited, an optional step pulls existing items onto it
>   from three sources: Discovery ideas sitting on other boards, **Issues in the delivery backlog**
>   (returned to Discovery), and a new pool of **ideas that belong to no board**. Ideas may now be
>   created without a board, and detached from one later.
> - **Key rules:** an idea may have no board (1–3); an idea is created without a board, or detached
>   from one by its author or an Org Admin (4–6); pool ideas show on the Ideas list and as a *Needs a
>   board* tile on Home (7); pulling happens in the save that creates or edits a board (9–10); Org
>   Admin pulls anything eligible, a User only their own Discovery ideas (11–12); each item keeps its
>   status if the board has that lane, else lands in the leftmost lane (13); one commit, all or
>   nothing (16); at most 100 items a save (17).
> - **Contracts:** `contracts/ideas.md` (the pool create, the list filter and the detach route) was
>   written in slice 177; `contracts/boards.md` (`POST`, `PUT` and `pull-candidates`) was written in slice 178. Proposed shapes
>   are under "Contract changes".
> - **Decisions:** 2026-10-13 "Boards can pull in existing items, and ideas can have no board"; the
>   same entry records the **eighth** S0.2 schema freeze amendment (`ideas.board_id` nullable).
> - **Comp:** `SPEC/mockups/comp-r-board-pull-in.html`, **approved as drawn by the user 2026-10-13**
>   (slice 180). The Home tile is drawn there only; `comp-r-home-dashboard.html` is unchanged.
> - **Answered by the user 2026-10-13:** the scope (all three sources), how ideas enter the pool (both
>   ways), where a pulled item lands, who may pull, and Q1–Q6 ("Answered questions" below). The comp's
>   approval on the same day settled the last open details ("Answered questions" below).

## Outcome

An organization that is reorganising its boards, or starting a new one, does not have to re-key work:
the new board is created with the right ideas already on it. Ideas that do not belong to any board
yet have a place to wait, and an Issue that was promoted too early can go back to Discovery on the
board where it now belongs.

## Terminology

| Term | Meaning |
|---|---|
| **Pool** | The ideas of an organization with no board (`board_id` is null). |
| **Pull** | Move an existing item onto a board in the save that creates or edits that board. |
| **Backlog Issue** | An Issue (`Delivery` phase) with no sprint (`SPEC/20-feature-issues-and-delivery.md`, "Delivery backlog"). Issues in a sprint are not pullable. |
| **Detach** | Remove a Discovery idea from its board, leaving it in the pool. |

## Rules

### Ideas with no board

1. **An idea may belong to no board.** `ideas.board_id` becomes nullable (it has no foreign key and no
   check constraint today, so this is one `ALTER COLUMN … DROP NOT NULL`), and so does
   `notification_events.board_id`, which would otherwise refuse the event of a pool idea. Existing
   ideas and events keep their board; there is no backfill.
2. **An idea in the pool is an ordinary Discovery idea** in everything but placement: it can be
   edited, commented on, upvoted and followed, carries tags, assignees and custom fields, and is
   visible to the whole organization under the same role rules. It sits in **no lane**, so it has no
   board column and no position, and **its status cannot be changed on its own**: the status route
   refuses it as a `400` ("This idea is not on a board."), and only a pull sets it (rule 13).
3. **A pool idea keeps a status.** `ideas.status_id` stays required: when an idea is created without a
   board its status is the organization's first active status in sort order (the same status the
   leftmost lane of a new board would carry). If the organization has no active status the creation
   is refused as a `400` keyed `statusId`. *(answered with the comp, 2026-10-13)*
4. **Create without a board.** The idea form's Board field is optional; leaving it empty creates the
   idea in the pool, through a new organization-level create route (today idea creation exists only
   under a board). **CSV import and the idea assistant stay board-scoped**: both are written around
   one board's lanes, and neither creates pool ideas. *(answered, Q6)* The author still follows
   automatically (following rule 4). The roles that may create are those that may create on a board:
   User and Org Admin of the organization (a Site Admin through View As); Read Only is `403` and a
   direct Site Admin is refused.
5. **Detach.** The author of a Discovery idea, or an Org Admin, may remove it from its board; the
   caller must still be a User or Org Admin, so a Read Only author may not. The idea keeps its status,
   tags, comments, upvotes and followers, has `updated_at_utc` stamped, and joins the pool. An **Issue cannot be
   detached**: return it to Discovery first (rule 14).
6. **Detaching from an archived board is allowed for an Org Admin.** Archiving a board makes it
   read-only, and without this exception its ideas would be stranded. No other edit to an archived
   board's ideas changes. A User may not detach from an archived board, even their own idea.
   *(answered, Q1)*
7. **Where pool ideas appear.** On the Ideas list, with a *No board* label in the Board column and a
   *No board* choice in the board filter; in search and the command palette; in the pull step
   (rule 9); and on **Home** as a *Needs a board* tile for an Org Admin (a Site Admin through View As),
   counting the organization's live Discovery ideas with no board and linking to the Ideas list
   filtered to *No board*. They appear on **no** board page, and they are not counted in any board's
   lane counts or in Home's board-based figures. *(answered, Q4)*
8. **Promotion.** A pool idea can be promoted to an Issue like any idea. The Issue has no board, and
   returning it to Discovery puts it back in the pool. *(answered, Q2)*

### Pulling onto a board

9. **Pulling happens in the save that creates or edits a board** *(answered, Q3)*. The board form,
   for a new board and for an existing live board's edit, gains an optional step, *Add existing
   items*, with three tabs: **Unassigned ideas**, **Ideas on other boards** and **Backlog Issues**
   (the last shown only to an Org Admin). Each tab searches by title and filters by tag and author,
   and lists items of the caller's organization only, **never the board's own ideas**. An archived
   board takes no pull: it is read-only and the edit already refuses (`409`). When one edit both
   removes a lane and pulls items, the lane removal and its `ideaMoves` apply first, and rule 13
   places pulled items on the board's lanes as they stand after that save.
10. **What is eligible.** An item must belong to the organization, not be deleted, and be one of:
    - a **Discovery idea with no board**;
    - a **Discovery idea on another board**, live or archived (never the target board's own);
    - a **backlog Issue**: `Delivery` phase, no sprint.

    An Issue in a Planned or Active sprint is not eligible; an admin returns it to the backlog first,
    with the sprint tools that exist.
11. **Who may pull.** An **Org Admin** (a Site Admin through View As) may pull any eligible item. A
    **User** may pull only Discovery ideas **they authored**, from the pool or from other boards.
    **Backlog Issues are Org Admin only**, because returning an Issue to Discovery is already
    admin-only (`SPEC/20-feature-issues-and-delivery.md`, Return to Discovery). A Read Only user cannot
    create a board and so cannot pull. A Site Admin acting as themselves is refused, as for every board
    write.
12. **A refused item refuses the save.** If any named item is not eligible, does not exist, belongs to
    another organization, or is outside the caller's rights under rule 11, **nothing is saved** (a new
    board is not created; an edit changes nothing) and the refusal names the item (below).
13. **Placement: keep the status, else the first lane.** An item keeps its status if the board has a
    lane for it; otherwise it lands in the board's leftmost lane and its status becomes that lane's.
    The lanes are those the same form saves. A lane has no stored position, so a pulled item
    takes its place among the lane's cards under the board's ordinary card ordering, like any other
    card. *(answered 2026-10-13; the in-lane order follows because no position column exists)*
14. **Backlog Issues are returned to Discovery, then placed.** For each, the existing Return to
    Discovery runs first (sprint and delivery status cleared; effort, the promotion snapshot and tasks
    retained, so a later re-promote is lossless), then rule 13 places it. The board it sat on before, if
    any, is replaced by this one. Return to Discovery on its own refuses an Issue whose board is
    archived; **inside a pull that refusal does not apply**, because the Issue is leaving that board.
15. **Side effects.** Per item: its board is set to this board; its status changes under rule 13;
    one audit event is written (below). **No notification is sent** and followers are unchanged: a pull
    is a re-filing, the same stance as a lane removal (`20-feature-boards-and-statuses.md` rule 14).
    `updated_at_utc` is stamped.
16. **One commit.** The board, its lanes, its audit event and every pulled item commit together. A
    failure anywhere, including an item that was moved or deleted between the picker loading and the
    save, saves nothing.
17. **Limits.** At most **100 items** per save. *(answered, Q5)*

### Audit

18. A pull writes, in the same commit:
    - `BoardCreated` or `BoardUpdated` as today, with metadata `pulledItemCount` and
      `returnedIssueCount`;
    - one `IdeaBoardChanged` per pulled item (`fromBoardId` or `null`, `toBoardId`), attributed to the
      real user with the View As target on behalf of, as every board write is;
    - `IdeaStatusChanged` for an item whose status changed under rule 13, in the shape slice 123 uses;
    - `IssueReturnedToDiscovery` for each returned Issue, as the existing action writes it.
19. A **detach** writes one `IdeaBoardChanged` (`toBoardId` is `null`). Creating an idea in the pool
    writes the same `IdeaCreated` as today.

## Contract changes (proposed; written in slices 177 and 178)

- **`POST /organizations/{orgId}/boards`** and **`PUT /organizations/{orgId}/boards/{boardId}`** gain an optional `pullItemIds`: an array of at most 100
  idea ids. Any other value is `400`, keyed `pullItemIds`. A refused item is `400` keyed `pullItemIds`
  with a message naming it (not found or not in this organization; not eligible and why; "you may pull
  only ideas you created"; Issues are Org Admin only; the 100-item cap). The response gains
  `pulledItems`: `{ ideaId, fromBoardId, statusId }[]`, so the client can refresh. On the `PUT`, naming
  an idea already on that board is `400` keyed `pullItemIds`, and an archived board stays `409`.
  Nothing else about either route changes.
- **`POST /organizations/{orgId}/ideas`** (new): creates an idea in the pool. The body is
  `POST /boards/{boardId}/ideas`'s without `statusId` (rule 3 fixes the status). `POST
  /boards/{boardId}/ideas` is unchanged, and so are CSV import and the idea assistant.
- **Idea shapes** (`GET`, list, create, update responses): `boardId` and the board name may be `null`.
- **`GET /organizations/{orgId}/ideas`**: the board filter accepts the literal `none` for *no board*.
- **`DELETE /ideas/{ideaId}/board`** (new): detach. `204`; `404` for a missing, deleted or foreign idea;
  `403` when the caller is neither the author nor an Org Admin; `409` for an Issue, and for an
  archived board unless the caller is an Org Admin (rule 6). Idempotent: an idea already in the pool
  answers `204`.
- **Picker reads** (decided in slice 178): the organization idea list cannot carry them, because it has
  no "not on board X" and cannot list Issues with no sprint, so a dedicated
  `GET /organizations/{orgId}/boards/pull-candidates?source=unassigned|boards|backlog` was added. It is
  specified in `contracts/boards.md`.

## UI (comp first)

- **Board form** (create and edit): the existing name, description and lane fields, then the optional
  *Add existing items* step with the three tabs of rule 9, a selected-items summary with a remove control,
  and a line saying where each item will land (rule 13). The step is collapsed by default.
- **Idea form:** Board becomes a select with a *No board* choice, preselected when the form opens from a
  board and empty when it opens from the Ideas list.
- **Idea drawer and Ideas list:** a *No board* label in place of the board name; a *Remove from board*
  action for the author and an Org Admin.
- **Home:** an Org Admin's *Needs a board* tile (rule 7), drawn into the Home comp with the rest;
  every other Home figure and every board count is unchanged. The tile reads the Ideas list with the
  `none` board filter, so it needs no new route.

## Acceptance criteria

- *Given* an Org Admin creating a board and naming two ideas on another board, one in the pool and one
  backlog Issue *When* the form is saved *Then* the board exists with all four on it, the Issue is in
  Discovery with its tasks, each item is in its previous lane's status where the new board has one
  and the leftmost lane otherwise, and one `IdeaBoardChanged` per item is audited.
- *Given* a User who authored idea A and did not author idea B *When* they name both *Then* nothing is
  created and `pullItemIds` is refused naming B.
- *Given* a User *When* they name a backlog Issue they authored *Then* the save is refused: Issues are
  Org Admin only.
- *Given* an item moved to another board after the picker loaded *When* the form is saved *Then* the
  save is refused naming it and no board exists.
- *Given* 101 ids *Then* `400` on `pullItemIds`.
- *Given* an Org Admin editing a live board and naming a pool idea *When* the form is saved *Then* the
  idea is on the board in a lane by rule 13; *given* the edit also removes a lane *Then* the removal's
  `ideaMoves` apply first.
- *Given* an archived board *When* an edit names items to pull *Then* `409` and nothing changes.
- *Given* an Org Admin with pool ideas *Then* Home shows *Needs a board* with their count, linking to the
  Ideas list filtered to *No board*; *given* a User *Then* no such tile.
- *Given* an idea created with an empty Board field *Then* it exists, has the organization's first
  active status, appears on the Ideas list as *No board*, and appears on no board page.
- *Given* the author of a Discovery idea *When* they remove it from its board *Then* it is in the pool,
  with comments, upvotes and followers intact, and no one is notified.
- *Given* an Issue *When* anyone tries to detach it *Then* `409`.
- *Given* an archived board *When* an Org Admin detaches one of its ideas *Then* it succeeds; *when* a
  User does, even for their own idea, *Then* `409`.
- *Given* a direct Site Admin *Then* every route here is refused, and through View As it acts as the
  target.

## Out of scope

A single-idea *Move to another board* action (it uses the same re-board primitive and is parked in
`SPEC/ideas-inbox.md`); pulling Issues out of a sprint; email or any notification for a pull; bulk
detach; a board-level default for new pool ideas.

## Answered questions

Answered by the user 2026-10-13; each is marked *(answered, Qn)* where it applies.

| # | Question | Answer |
|---|---|---|
| Q1 | Detach an idea from an **archived** board? | **Yes, Org Admin only** (rule 6). A User may not, even for their own idea. |
| Q2 | Promote a **pool idea** to an Issue? | **Yes**; the Issue has no board (rule 8). |
| Q3 | Pull onto **existing** boards too? | **Yes**: the board edit form gets the same step, in slice 178 (rule 9). |
| Q4 | Surface pool ideas beyond the Ideas list? | **Yes: a *Needs a board* count on Home** for an Org Admin (rule 7). |
| Q5 | Cap per save | **100 items** (rule 17). |
| Q6 | CSV import and the idea assistant create pool ideas? | **No**, both stay board-scoped (rule 4). |

Settled by the user's approval of the comp as drawn (2026-10-13): the status a pool idea is created
with (rule 3); the in-lane order (no stored position, so the ordinary card ordering, rule 13); the
*Needs a board* tile is **hidden at a count of 0**; an item pulled from a lane being removed in the
same save lands by rule 13, in the first lane if its status has no lane; and a pull asks for **no
confirmation**, only the per-row *Lands in* hints.

## Code touchpoints (for slices 177 and 178; read from the code 2026-10-13)

- **Domain.** `createIdea` requires a board id (`packages/domain/src/ideas/idea.ts`) and must accept
  none; the notification event's `boardId` becomes optional. A board is set only at creation today and
  `PUT /ideas/{id}` has no board field, so a re-board primitive is new. Return to Discovery
  (`returnIdeaToDiscovery`) clears phase, delivery status and sprint only; it keeps the board and the
  status.
- **Application.** `IdeaService.create` is board-scoped (`getBoardContext`, `leftMostStatusId`) and needs
  a sibling for the pool. Every `getBoardContext(idea.boardId)` caller needs a null case:
  `ensureIdeaBoardNotArchived` (used by update, status change, delete, promote and return),
  `changeStatus`, and the comment, task and notification inputs that pass `boardId`. `BoardService.create`
  already admits a User (`ensureCreateScope`), so the pull needs its own role check (rule 11);
  `BoardService.update` (`ensureAdminScope`) already plans `ideaMoves` for removed lanes, and the pull
  runs after it in the same unit of work.
- **Infrastructure.** `moveIdeas` and `listLaneIdeas` are keyed by board and status and cannot re-board:
  a new `reassignIdeas(ideaIds, toBoardId, statusPlacements)` runs after the new board is added in the
  same unit of work. The idea list's raw SQL already `LEFT JOIN`s boards and needs the `none` filter and
  null ordering; the tag usage query `INNER JOIN`s boards and would silently drop pool ideas from tag
  counts, so it becomes a `LEFT JOIN`. The demo seed and `test/support` probes build ideas with boards
  and need no change.
- **API and web.** A new create route and the detach route on `ideas.controller.ts`; `pullItemIds` on the
  board create body; `boardId: string` in `apps/web/lib/types.ts` and `adapt.ts` becomes
  `string | null`, and the card actions' hidden `boardId` input stops assuming one. The inbox and Home
  already tolerate a null board name.
- **Audit and notifications.** `audit_events.event_type` is a free string, so `IdeaBoardChanged` needs no
  migration, and no notification type is added.
- **Golden.** `ideas.create`, `ideas.list`, `ideas.get` and `boards.create` carry the touched shapes.
  Additive optional fields and a nullable `boardId` that is never null in the corpus should leave the
  replay unchanged; slice 177 confirms it.
