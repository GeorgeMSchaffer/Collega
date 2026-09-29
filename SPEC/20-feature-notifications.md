# Feature: Notifications

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** persisting `NotificationEvent` rows for four collaboration triggers (MVP); email delivery,
>   per-user preferences and an inbox UI are a later phase.
> - **Key rules:** triggers are idea mention, comment mention, comment added and status change; recipients
>   per trigger as listed; self-notifications are suppressed; each event stores the link `/ideas/{ideaId}`;
>   no SMTP, email client or outbound HTTP in the path; no read or query endpoints required in MVP.
> - **Contracts:** contracts/notifications.md
> - **Decisions:** none recorded

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
4. An idea's status changes (notify idea author and assignee). **Except** when the move is a board save removing the idea's lane (`20-feature-boards-and-statuses.md` rule 14): those moves notify no one (decided by the user 2026-09-29, `SPEC/decisions.md` "Removing a lane moves its ideas").

Self-notifications are suppressed: no event is written when the actor and the recipient are the same user.

## Recipients
- Idea mention → mentioned user only
- Comment mention → mentioned user only
- Comment added → idea author + idea assignee (each, if different from actor)
- Status change → idea author + idea assignee (each, if different from actor)

## Canonical Idea Link
Each event persists a canonical link to the idea, stored in the `NotificationEvent` row alongside the idea title:

```
/ideas/{ideaId}
```

- It is the canonical single-idea route: following it opens the Ideas list with that idea's detail drawer open (see `SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)"; the "Idea Detail Surface" section this cited no longer exists).
- **Change from prior spec**: it supersedes the earlier `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` full-page route, to match the updated client routing (`SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)", `SPEC/20-feature-client-ui-revisions.md`).

## Implementation Design (MVP)

### Application layer
- `NotificationEventType` (`packages/domain/src/enums`): `IdeaMention`, `CommentMention`, `CommentAdded`, `IdeaStatusChanged` (Issues & Delivery adds its own event types — `20-feature-issues-and-delivery.md`).
- A `NotificationWriter` port (`packages/application/src/notifications/models.ts`) with one operation, `notify(input)`; the input carries the event type, recipient, actor, idea id and title, board id and organization id.
- `NotificationService` implements it: it applies self-notification suppression and builds the event through the domain factory.
- The idea and comment services call it from the mention, comment, and status-move paths, each through its own narrow port.

### Infrastructure layer
- `NotificationEventRepository` (`packages/infrastructure/src/repositories/notification-event.repository.ts`) persists the events.
- Inserts one `NotificationEvent` row per recipient per event (no batching in MVP).
- Fields populated: `RecipientUserId`, `EventType`, `IdeaId`, `IdeaTitle`, `OrgId`, `TriggeredByUserId`, `Link` (`/ideas/{ideaId}`), `OccurredAtUtc`.
- No SMTP, email client, or outbound HTTP — purely database writes.

### Test coverage
The .NET tests T037–T039 were discarded with that suite (ticket `10`; `SPEC/50-typescript-migration.md` §1). What they asserted still holds and is what coverage checks:
- the idea and comment paths emit `IdeaMention` / `CommentMention` / `CommentAdded` / `IdeaStatusChanged` events through the writer port, observable with a fake writer;
- an emitted event's `Link` field equals `/ideas/{ideaId}`;
- the notification path has no SMTP client and no outbound HTTP client.

## Delivery Rules (later phase)
1. One email per event (no consolidation).
2. Email must include the idea title and the canonical link.
3. Per-user opt-out preferences are not in scope for MVP.
4. Approval-workflow events (approve/reject/expire) follow the same rules when implemented.

## Acceptance Criteria
- [ ] The `NotificationWriter` port and its implementation are implemented and registered
- [ ] The idea and comment services call the writer for all four trigger events
- [ ] Self-notifications are suppressed (actor == recipient → no event written)
- [ ] Each emitted event's `Link` field stores `/ideas/{ideaId}`
- [ ] No SMTP, email client, or outbound HTTP code is present in the notification path
- [ ] Notification events do not require read or query API endpoints in MVP
- [ ] Email delivery and per-user preferences remain deferred outside MVP
