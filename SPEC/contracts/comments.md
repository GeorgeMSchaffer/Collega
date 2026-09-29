# Contracts: comments

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Comment Contracts

### `GET /api/v1/ideas/{ideaId}/comments`
List comments for an idea with pagination and chronological ordering.

- **Roles:** —
- **Request:** query parameters
  - `page`
  - `pageSize`
  - `sortBy` fixed to chronological order
  - `sortDirection` optional `asc` or `desc`
- **Response:** `200` paged item shape
  - `commentId`
  - `ideaId`
  - `authorUserId`
  - `author` object using the idea-list assignee item shape, or `null` — who wrote the comment
  - `body`
  - `createdAtUtc`
  - `updatedAtUtc`
- **Errors:** —
- **Rules:**
  - `author` (added 2026-09-10, for the reason `GET /api/v1/ideas/{ideaId}` gained its own): the thread renders a name and avatar per comment, and `authorUserId` alone would cost one request per distinct commenter — so the inspector rendered invented commenters from fixture data instead.
  - It is the **same object** an assignee and the idea's `author` are, and the same object the detail's embedded `comments` carry, so a thread rendered from either endpoint agrees with the other and a client needs one way to read a person off an idea payload.
  - A `null` author means no user row for `authorUserId`, and only that. Nullable because `comments.author_user_id` carries no foreign key (the schema is frozen at S0.2); no code path deletes a user, so it does not occur in practice — a `null` is data damage, not an ordinary case to design a label for.
  - **A deactivated commenter is not that case**: the row still exists, so the author comes back named with `isActive` false, exactly as a deactivated assignee does.

### `POST /api/v1/ideas/{ideaId}/comments`
Add a comment to an idea.

- **Roles:** —
- **Request:** body
  - `body` required string, max 2000 characters, plain text with line breaks
  - `mentionEmails` optional string array — same organization-scoped, email-based mention resolution as ideas (`SPEC/20-feature-ideas-and-engagement.md` "Comments" #5)
- **Response:** `201`
  - `commentId`
  - `ideaId`
- **Errors:** **an unresolved address is rejected with 400**, keyed on `mentionEmails`, using the canonical mention-resolution message in "Validation Message Conventions" in [`SPEC/30-Contracts.md`](../30-Contracts.md).
- **Rules:**
  - **Corrected 2026-09-06** — the `mentionEmails` line previously read "unresolved addresses are ignored", which described behaviour the implementation never had: ideas and comments share one `IMentionResolver`, and it has always thrown. See `SPEC/decisions.md`.
  - UX: clients should show a live character counter and inline overflow validation.

### `PUT /api/v1/comments/{commentId}`
Edit a comment authored by the caller.

- **Roles:** the comment's author (the caller).
- **Request:** body
  - `body` required string, max 2000 characters, plain text with line breaks
- **Response:** `200`: the edited comment, in the same item shape the list above answers — `author` included, so the composer can replace the edited comment in place without refetching the thread.
- **Errors:** —
- **Rules:** UX: clients should show a live character counter and inline overflow validation.

### `DELETE /api/v1/comments/{commentId}`
Delete a comment authored by the caller or by an authorized admin.

- **Roles:** the comment's author, or an authorized admin.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** —
- **Rules:** —
