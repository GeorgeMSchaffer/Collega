# Feature: Boards and Statuses

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** org-level statuses and boards with status swimlanes; the approval workflow is post-MVP,
>   deferred and not implemented.
> - **Key rules:** statuses soft-delete only, not while a swimlane on an active board (Status 5-6); an org
>   keeps at least 2 active statuses (Status 7); a board needs at least 2 swimlanes (Board 3); boards are
>   archived, not deleted, by an Org Admin, and open read-only (Board 13); `/boards`, `/board/{boardId}` (10).
> - **Contracts:** contracts/boards.md, contracts/statuses.md
> - **Decisions:** 2026-09-27 "Boards gain a description, and the board list carries what a card needs";
>   2026-09-27 "The S0.2 schema freeze is amended a third time, for structured ideas and board archive";
>   2026-09-02 "The board is a scrolling rail of fixed-width columns"

## Outcome
Organizations can manage idea boards using configurable status swimlanes.

## Status Rules
1. Statuses are defined at the organization level.
2. An in-scope Org Admin can create, edit, and delete statuses; a Site Admin does so only while acting through View As (`20-feature-view-as.md` rules 25–25b; corrected 2026-09-29, `SPEC/decisions.md` "Spec contradictions resolved").
3. Default statuses are:
   - New / Pending
   - In Review
   - In Progress
   - Client Review
   - Complete
4. The default statuses are provisioned automatically when a new organization is created, with these canonical `Color` and `SortOrder` values:

   | Status | `Color` | `SortOrder` |
   |---|---|---|
   | New / Pending | `#64748B` (slate) | 10 |
   | In Review | `#D97706` (amber) | 20 |
   | In Progress | `#2563EB` (blue) | 30 |
   | Client Review | `#7C3AED` (purple) | 40 |
   | Complete | `#16A34A` (green) | 50 |

   - `#64748B` is also the fallback `Color` for a custom status created without one (rule #9).
   - Provisioned once at organization creation; an Org Admin may change them afterward like any other status.
5. Status deletion is soft-delete only, so existing board and idea references remain valid.
6. A status that is currently referenced as a swimlane on any active board cannot be soft-deleted; the delete must be rejected with an appropriate error until the swimlane reference is removed.
7. An organization must retain at least 2 active statuses at all times; a delete that would drop it below 2 is rejected, whether or not the status is a swimlane on any board.
   - Why: matches a board's own 2-swimlane minimum (not the 1-active-option minimum used for Idea Type/Business Impact), so an organization is never left unable to create a new board.
8. Historical or detail views that reference a soft-deleted status must continue to show the prior status name with an archived or deleted label.
9. Each status has an admin-editable `Color` in `#RRGGBB` format — the format is enforced by the API, within a 20-character column (corrected 2026-09-29 from "hex/CSS color"; `contracts/statuses.md`) — used for the swimlane color dot and, where configured, the idea card's status chip.
10. Each status has an admin-controlled `SortOrder` (integer): its default position in the organization's status catalog (e.g. the Settings > Statuses list, and the default order offered when configuring a new board's swimlanes).
    - Distinct from a board's own swimlane order, which a board can reorder by drag-and-drop without changing the organization-level catalog order.

## Board Rules
1. A board is a collection of ideas organized by swimlanes.
2. Each swimlane maps to a status.
3. A board must have at least 2 swimlanes.
4. Each new organization starts with one default board.
5. An in-scope Org Admin can — and a Site Admin only while acting through View As (corrected 2026-09-29):
   - select statuses used by a board
   - reorder swimlanes by drag-and-drop
   - bulk-import ideas from a CSV file
6. Swimlane order changes are saved immediately when the drag-and-drop action completes.
7. Board views must provide guided empty states with a primary action and short explanatory text when no ideas exist.
8. In Development, each seeded demo organization includes exactly two example boards, each with 11 deterministic ideas distributed `3/2/2/1/3` across the five statuses in the canonical order above.
9. User-facing copy uses `Board` or `Boards`, never `Workflow` or `Workflows`.
10. Canonical client routes: `/boards` (board list) and `/board/{boardId}` (board detail). `/board`, `/workflow`, `/workflows`, and `/workflow/{boardId}` redirect to the corresponding canonical route.
11. Internal application service and namespace names may retain `Workflow` where they are not user-visible.
12. A board may carry an optional description of at most 500 characters, trimmed; a blank description is stored as none. An in-scope Org Admin sets it when creating or editing the board (added 2026-09-27, `SPEC/decisions.md`); a Site Admin only while acting through View As (corrected 2026-09-29).
13. A board is **archived, not deleted** (added 2026-09-27, `decisions.md`; until then boards had no delete endpoint or action).
    - Only an Org Admin of its organization archives or unarchives it, after confirmation.
    - An archived board keeps its swimlanes and ideas, leaves the default board list and every board picker, and accepts no new ideas; its ideas stay reachable from the Ideas list.
    - Unarchiving restores it unchanged.
    - Its own page opens **read-only** with an *Archived* banner (Q4, answered 2026-09-27): lanes and list still show; adding, moving and editing are unavailable; an Org Admin sees *Unarchive* in the banner.
    - Its settings (name, description, lanes and their order) cannot be edited while archived; unarchive it first.

## Approval Workflow Decisions (Post-MVP — Deferred)
For a future post-MVP approval workflow on board status transitions. **None of these behaviors are implemented in MVP.** When implemented:
- A board may expose an approval-required transition only when the target status is configured as reviewable by the organization.
- Only Org Admins, Site Admin, and the idea author can initiate or resolve approval actions for an idea.
- Approval actions are logged as audit events and remain visible in the idea history.
- A rejected or expired transition must not silently drop the original state; the previous state is restored and the reason is retained.

## Acceptance Criteria
- [ ] Organization-scoped statuses can be created and maintained
- [ ] A new organization receives the default status set automatically
- [ ] Deleting a status performs a soft delete so existing references remain valid
- [ ] A status referenced as a swimlane on any active board cannot be soft-deleted; the delete is rejected with an error
- [ ] An organization cannot be reduced below 2 active statuses; a delete that would do so is rejected with an error, even if the status being deleted is not currently referenced as a swimlane
- [ ] Historical or detail views show soft-deleted status names with an archived or deleted label
- [ ] Statuses support an admin-editable `#RRGGBB` `Color` used by the swimlane color dot and idea card status chip
- [ ] Statuses support an admin-controlled `SortOrder` for the organization's default status catalog order, independent of any single board's swimlane order
- [ ] A board cannot be created with fewer than 2 swimlanes
- [ ] A new organization receives one default board
- [ ] Boards can select a subset of org statuses
- [ ] Swimlane order can be changed and is saved immediately
- [ ] Board screens provide guided empty states with a primary action and short explanatory text when no ideas exist
- [ ] Development startup seed includes exactly two example boards per demo organization
- [ ] Each seeded example board contains 11 ideas distributed `3/2/2/1/3` in canonical status order
- [ ] An Org Admin, and a Site Admin through View As, can bulk-import ideas from a CSV file
- [ ] User-facing navigation, headings, actions, and messages use Board terminology
- [ ] `/boards` and `/board/{boardId}` are canonical and legacy Workflow routes redirect without data loss
