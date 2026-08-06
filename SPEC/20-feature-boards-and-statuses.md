# Feature: Boards and Statuses

## Outcome
Organizations can manage idea boards using configurable status swimlanes.

## Status Rules
1. Statuses are defined at the organization level.
2. Site Admin and Org Admin can create, edit, and delete statuses.
3. Default statuses are:
   - New / Pending
   - In Review
   - In Progress
   - Client Review
   - Complete
4. The default statuses are provisioned automatically when a new organization is created.
5. Status deletion is soft-delete only so existing board and idea references remain valid.
6. A status that is currently referenced as a swimlane on any active board cannot be soft-deleted; the delete must be rejected with an appropriate error until the swimlane reference is removed.
7. Historical or detail views that reference a soft-deleted status must continue to show the prior status name with an archived or deleted label.

## Board Rules
1. A board is a collection of ideas organized by swimlanes.
2. Each swimlane maps to a status.
3. A board must have at least 2 swimlanes.
4. Each new organization starts with one default board.
5. Site Admin and Org Admin can:
   - select statuses used by a board
   - reorder swimlanes by drag-and-drop
   - bulk-import ideas from a CSV file
6. Swimlane order changes are saved immediately when the drag-and-drop action completes.
7. Board views must provide guided empty states with a primary action and short explanatory text when no ideas exist.
8. In Development, each seeded demo organization includes one example board with at least one idea in each default swimlane.
9. User-facing copy uses `Board` or `Boards`, never `Workflow` or `Workflows`.
10. The canonical client routes are `/boards` for the board list and `/board/{boardId}` for board detail. `/board`, `/workflow`, `/workflows`, and `/workflow/{boardId}` redirect to the corresponding canonical route.
11. Internal application service and namespace names may retain `Workflow` where they are not user-visible.

## Approval Workflow Decisions (Post-MVP — Deferred)
The following decisions apply to a future post-MVP approval workflow for board status transitions. **None of these behaviors are implemented in MVP.**

When implemented:
- A board may expose an approval-required state transition only when the target status is configured as reviewable by the organization.
- Only Org Admins, Site Admin, and the idea author can initiate or resolve approval actions for an idea.
- Approval actions are logged as audit events and remain visible in the idea history.
- A status transition that is rejected or expired must not silently drop the original state; the previous state is restored and the reason is retained.

## Acceptance Criteria
- [ ] Organization-scoped statuses can be created and maintained
- [ ] A new organization receives the default status set automatically
- [ ] Deleting a status performs a soft delete so existing references remain valid
- [ ] A status referenced as a swimlane on any active board cannot be soft-deleted; the delete is rejected with an error
- [ ] Historical or detail views show soft-deleted status names with an archived or deleted label
- [ ] A board cannot be created with fewer than 2 swimlanes
- [ ] A new organization receives one default board
- [ ] Boards can select a subset of org statuses
- [ ] Swimlane order can be changed and is saved immediately
- [ ] Board screens provide guided empty states with a primary action and short explanatory text when no ideas exist
- [ ] Development startup seed includes one example board per demo organization
- [ ] Each seeded example board includes ideas across every default swimlane
- [ ] Site Admin and Org Admin can bulk-import ideas from a CSV file
- [ ] User-facing navigation, headings, actions, and messages use Board terminology
- [ ] `/boards` and `/board/{boardId}` are canonical and legacy Workflow routes redirect without data loss