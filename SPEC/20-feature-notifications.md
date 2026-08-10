# Feature: Notifications

## Outcome
Notification events are persisted for collaboration events. Email delivery is deferred to a later phase.

## Scope
- **MVP (in)**: Persist `NotificationEvent` rows to the database for all trigger events below.
- **Later phase (out)**: Queued email delivery, per-user notification preferences, notification inbox UI.

## Notification Triggers
A notification event is created when:
1. A user is @mentioned in an idea body
2. A user is @mentioned in a comment
3. A comment is added to an idea (notify idea author and assignee)
4. An idea's status changes (notify idea author and assignee)

Self-notifications are suppressed: no event is written when the actor and the recipient are the same user.

## Recipients
- Idea mention → mentioned user only
- Comment mention → mentioned user only
- Comment added → idea author + idea assignee (each, if different from actor)
- Status change → idea author + idea assignee (each, if different from actor)

## Canonical Idea Link
Each notification event persists a canonical link to the idea:

```
/ideas/{ideaId}
```

This is the canonical single-idea route; following it opens the Ideas list with that idea's detail drawer open (see the Idea Detail Surface in `SPEC/20-feature-client-ui.md`). The link is stored in the `NotificationEvent` row alongside the idea title.

> **Change from prior spec**: The earlier route pattern `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` full-page route are both superseded by `/ideas/{ideaId}` (drawer-addressable) to match the updated client routing (see `SPEC/20-feature-client-ui.md` Idea Detail Surface and `SPEC/20-feature-client-ui-revisions.md`).

## Implementation Design (MVP)

### Application layer
- `NotificationEventType` enum: `IdeaMention`, `CommentMention`, `CommentAdded`, `IdeaStatusChanged`
- `INotificationWriter` interface:
  ```csharp
  Task WriteAsync(Guid recipientUserId, Guid actorUserId, NotificationEventType eventType,
                  Guid ideaId, string ideaTitle, Guid organizationId, CancellationToken ct);
  ```
- Injected into `WorkflowManagementService`; called from mention, comment, and status-move paths.

### Infrastructure layer
- `NotificationWriter` implements `INotificationWriter`
- Inserts one `NotificationEvent` row per recipient per event (no batching in MVP)
- Fields populated: `RecipientUserId`, `EventType`, `IdeaId`, `IdeaTitle`, `OrgId`, `TriggeredByUserId`, `Link` (`/ideas/{ideaId}`), `OccurredAtUtc`
- No SMTP, email client, or outbound HTTP — purely database writes

### Test coverage (T037–T039)
- **T037**: `WorkflowManagementService` emits `IdeaMention` / `CommentMention` / `CommentAdded` / `IdeaStatusChanged` events via `INotificationWriter`; `FakeNotificationWriter` collects events for assertion.
- **T038**: Emitted event `Link` field equals `/ideas/{ideaId}`.
- **T039**: Infrastructure DI registration test asserts `INotificationWriter` resolves to `NotificationWriter` and that no `SmtpClient` or `IHttpClientFactory` descriptor is present in the service collection.

## Delivery Rules (later phase)
1. One email per event (no consolidation).
2. Email must include the idea title and the canonical link.
3. Per-user opt-out preferences are not in scope for MVP.
4. Approval-workflow events (approve/reject/expire) follow the same rules when implemented.

## Acceptance Criteria
- [ ] `INotificationWriter` and `NotificationWriter` are implemented and registered
- [ ] `WorkflowManagementService` calls `INotificationWriter` for all four trigger events
- [ ] Self-notifications are suppressed (actor == recipient → no event written)
- [ ] Each emitted event's `Link` field stores `/ideas/{ideaId}`
- [ ] No SMTP, email client, or outbound HTTP code is present in the notification path (T039 test guard)
- [ ] Notification events do not require read or query API endpoints in MVP
- [ ] Email delivery and per-user preferences remain deferred outside MVP