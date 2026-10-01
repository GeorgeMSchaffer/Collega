# Contracts: notifications

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Notification Event Contract

No route: these are internal events.

### Internal notification event types
- `IdeaMentioned`
- `CommentMentioned`
- `IdeaCommented`
- `IdeaStatusChanged`

*Corrected 2026-10-01, written from the code (`SPEC/decisions.md` 2026-09-29, "Contracts and wording
written from the code"):* the list above predates the code. The types are the `NotificationEventType`
enum, and the inbox below sends them by these names: `IdeaMention`, `CommentMention`, `CommentAdded`,
`IdeaStatusChanged`, `IdeaPromoted`, `IssueDeliveryStatusChanged`, `IssueTaskAssigned`, and, added
2026-10-01, `IdeaEdited` (`SPEC/20-feature-idea-following.md` rule 12).

### Internal notification event payload
- `eventId` GUID string
- `eventType` string
- `organizationId` GUID string
- `boardId` GUID string
- `ideaId` GUID string
- `actorUserId` GUID string
- `recipientUserId` GUID string
- `occurredAtUtc` UTC timestamp
- `ideaLink` string using `/ideas/{ideaId}` (drawer-addressable; supersedes both the earlier `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` patterns; see `SPEC/20-feature-notifications.md`)
- `message` human-readable event summary string
- `metadata` object for event-specific context

MVP event query scope:
- audit and notification events must be persisted for internal processing and verification
- read or query endpoints for those events are not required in MVP
- verification should be provided through tests and internal diagnostics outside the public API surface

*Superseded in part 2026-10-01 (`SPEC/decisions.md`, "Following an idea, and an in-app notification
inbox"):* a person reads **their own** notification events through the inbox routes below. Audit events
still have no read route.

## Notification Inbox Contracts

Added 2026-10-01 (`SPEC/20-feature-idea-following.md` rules 20–32). Every route reads or marks the
**caller's own** notifications — `recipient_user_id` is the current user, which under View As is the
target (`20-feature-view-as.md` rule 4). No route takes a user id. The window is the last 90 days
(feature rule 26), and a soft-deleted idea's notifications are left out (feature rule 27); both apply to
the list and the count alike.

### `GET /api/v1/notifications`
List the caller's notifications, newest first.

- **Roles:** any authenticated caller. A Site Admin acting as themselves gets an empty page.
- **Request:** query parameters
  - `page` optional, 1-based
  - `pageSize` optional; absent is `20`, clamped to 1–100 (`30-Contracts.md` "Collection Conventions")
- **Response:** `200` paged shape (`items`, `page`, `pageSize`, `totalCount`, `sortBy` `occurredAt`,
  `sortDirection` `desc`); each item:
  - `notificationId`
  - `eventType` string, one of the `NotificationEventType` names above
  - `ideaId`
  - `ideaTitle` string — the title when the event was written
  - `link` string, `/ideas/{ideaId}`
  - `actor` object using the board-list assignee item shape (`userId`, `firstName`, `lastName`,
    `displayName`, `isActive`), or `null`
  - `occurredAtUtc` timestamp
  - `readAtUtc` timestamp, or `null` when unread
- **Errors:** —
- **Rules:**
  - Ordered by `occurredAtUtc` descending, then `notificationId`, so paging is stable. There is no other
    sort and no filter.
  - `actor` is `null` only when no user row exists for `actor_user_id`, which has no foreign key: data
    damage, as for a comment's `author`.
  - No board or status names: the event stores neither (feature rule 37).

### `GET /api/v1/notifications/unread-count`
Count the caller's unread notifications, for the sidebar badge.

- **Roles:** as the list.
- **Request:** —
- **Response:** `200`
  - `unreadCount` integer, uncapped (the client shows `99+`)
- **Errors:** —
- **Rules:** counts exactly the rows the list would return with `readAtUtc` `null`.

### `POST /api/v1/notifications/{notificationId}/read`
Mark one of the caller's notifications read, when its row is opened.

- **Roles:** the notification's recipient.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** `404` when the notification does not exist or belongs to someone else.
- **Rules:** idempotent; a notification already read keeps its first `readAtUtc`. Not audited.

### `POST /api/v1/notifications/read-all`
Mark every unread notification of the caller's read.

- **Roles:** any authenticated caller.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** —
- **Rules:**
  - Sets `readAtUtc` to the same instant on every unread row of the caller's, inside or outside the
    window; rows already read keep theirs. Idempotent. Not audited.
  - Under View As it marks the target's notifications (feature rule 31).
