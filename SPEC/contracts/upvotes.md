# Contracts: upvotes

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Upvote Contracts

### `POST /api/v1/ideas/{ideaId}/upvote/toggle`
Purpose: Toggle the caller's upvote on an idea.

Success response `200`:
- `ideaId`
- `hasUpvoted` boolean
- `upvoteCount` integer

