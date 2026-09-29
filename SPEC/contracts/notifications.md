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
