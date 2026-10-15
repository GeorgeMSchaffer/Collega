# Contracts: idea dependencies

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md). *Planned 2026-10-15; specified in `SPEC/20-feature-board-references.md`.*

An **idea dependency** says one item cannot start until another is final. Both items are on the same board. No dependency means parallel.

### `PUT /api/v1/ideas/{ideaId}/blocked-by`

- **Roles:** anyone who may edit the item. Read Only is refused with `403`.
- **Body:** `{ "ideaIds": ["<guid>", ...] }`, the complete blocker set; `[]` clears it.
- **Success:** `200` with the item (`blockedBy` as in `contracts/ideas.md`).
- **Errors:** `401`; `403`; `404` the item or a named blocker does not exist or is outside caller scope; `422` for any of: a blocker equal to the item (`blockerIsSelf`), a blocker on another board (`blockerOnOtherBoard`), a set that would form a cycle (`dependencyCycle`).
- **Rules:** replacing the set is atomic. Deleting an item removes its dependencies in both directions. Adding a blocker to a task that has already left its first lane is allowed; it only affects later moves.
