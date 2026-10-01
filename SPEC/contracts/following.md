# Contracts: following

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Following Contracts

Added 2026-10-01 (`SPEC/20-feature-idea-following.md`; `SPEC/decisions.md` 2026-10-01, "Following an
idea, and an in-app notification inbox"). The caller's follow state and the follower count also ride
on `GET /api/v1/ideas/{ideaId}` ([`contracts/ideas.md`](ideas.md)).

### `PUT /api/v1/ideas/{ideaId}/follow`
Follow an idea, as the caller.

- **Roles:** any member of the idea's organization who can see it — User, Org Admin and Read Only — and
  a Site Admin through View As (as the target).
- **Request:** —
- **Response:** `200`
  - `ideaId`
  - `isFollowing` boolean, `true`
  - `followerCount` integer, after the change
- **Errors:**
  - `403` for a Site Admin acting as themselves (`20-feature-view-as.md` rule 25, as for upvotes).
  - `404` when the idea does not exist, is soft-deleted, or is outside the caller's organization.
- **Rules:**
  - Idempotent: following an idea already followed answers `200` with the same shape and changes
    nothing.
  - Follows only the caller. No request names another user (feature rule 3).
  - Allowed on an idea on an archived board and on a promoted Issue: following is a read.
  - Writes no audit event and no notification, and leaves the idea's `updated_at_utc` alone.

### `DELETE /api/v1/ideas/{ideaId}/follow`
Stop following an idea, as the caller.

- **Roles:** as `PUT` above.
- **Request:** —
- **Response:** `200`
  - `ideaId`
  - `isFollowing` boolean, `false`
  - `followerCount` integer, after the change
- **Errors:** as `PUT` above.
- **Rules:**
  - Idempotent: unfollowing an idea not followed answers `200` and changes nothing.
  - The author and assignees may unfollow; later edits do not re-follow them, and being newly added as
    an assignee does (feature rule 6).
  - A `200` with a body rather than `204`, so the toggle shows the new count without refetching the
    detail.
