# Feature: Notifications

> **At a glance** (added 2026-09-28, updated 2026-10-01; the text below wins where they differ)
> - **Scope:** persisting `NotificationEvent` rows for collaboration triggers, read in an in-app inbox
>   (`20-feature-idea-following.md`, from 2026-10-01); email delivery and per-user preferences are a later
>   phase.
> - **Key rules:** triggers are idea mention, comment mention, comment added, status change, and since
>   2026-10-01 promotion and idea edit (`IdeaEdited`); comment, status, promotion and edit events go to the
>   idea's **followers**, mentions to the mentioned person only; self-notifications are suppressed; each
>   event stores the link `/ideas/{ideaId}`; no SMTP, email client or outbound HTTP in the path; the inbox
>   routes read and mark the caller's own events.
> - **Contracts:** contracts/notifications.md, contracts/following.md
> - **Decisions:** 2026-10-01 "Following an idea, and an in-app notification inbox"; 2026-10-01 "The S0.2
>   schema freeze is amended a fifth time, for idea followers and read state"

## Outcome
Notification events are persisted for collaboration events. Email delivery is deferred to a later phase.

## Scope
- **MVP (in)**: Persist `NotificationEvent` rows to the database for all trigger events below.
- **Later phase (out)**: Queued email delivery, per-user notification preferences, notification inbox UI.
- *Superseded in part 2026-10-01 (`decisions.md`, "Following an idea, and an in-app notification
  inbox"):* the **inbox is now in scope** — an unread count and a list, specified in
  `20-feature-idea-following.md`. Email and preferences stay out.

## Notification Triggers
A notification event is created when:
1. A user is @mentioned in an idea body
2. A user is @mentioned in a comment
3. A comment is added to an idea (notify idea author and assignee)
4. An idea's status changes (notify idea author and assignee). **Except** when the move is a board save removing the idea's lane (`20-feature-boards-and-statuses.md` rule 14): those moves notify no one (decided by the user 2026-09-29, `SPEC/decisions.md` "Removing a lane moves its ideas").

5. *Added 2026-10-01:* an idea is promoted to an issue (`IdeaPromoted`, already written since
   Issues-and-Delivery Slice 1), or its delivery status moves (`IssueDeliveryStatusChanged`).
6. *Added 2026-10-01:* an idea is edited or reassigned (`IdeaEdited`, a new type) — once per save that
   changes something (`20-feature-idea-following.md` rule 12).

*Superseded in part 2026-10-01 (`decisions.md`, "Following an idea, and an in-app notification
inbox"):* triggers 3 and 4 notify the idea's **followers**, not "idea author and assignee". The author
and each assignee follow automatically, so they still hear unless they unfollow
(`20-feature-idea-following.md` rules 4–11). The lane-removal exception in trigger 4 stands.

Self-notifications are suppressed: no event is written when the actor and the recipient are the same user.
*Added 2026-10-01:* one row per recipient per action — a person who qualifies twice (mentioned and
following) gets the mention only (`20-feature-idea-following.md` rule 18).

## Recipients
- Idea mention → mentioned user only
- Comment mention → mentioned user only
- Comment added → idea author + idea assignee (each, if different from actor) — *superseded
  2026-10-01:* every follower, if different from actor
- Status change → idea author + idea assignee (each, if different from actor) — *superseded
  2026-10-01:* every follower, if different from actor
- Promotion and delivery-status move → *since 2026-10-01* every follower, if different from actor
  (previously idea author + assignees, `20-feature-issues-and-delivery.md`)
- Idea edited or reassigned → *since 2026-10-01* every follower, if different from actor
- Task assigned → the task's new assignee only (unchanged)

## Canonical Idea Link
Each event persists a canonical link to the idea, stored in the `NotificationEvent` row alongside the idea title:

```
/ideas/{ideaId}
```

- It is the canonical single-idea route: following it opens the Ideas list with that idea's detail drawer open (see `SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)"; the "Idea Detail Surface" section this cited no longer exists).
- **Change from prior spec**: it supersedes the earlier `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` full-page route, to match the updated client routing (`SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)", `SPEC/20-feature-client-ui-revisions.md`).

## Implementation Design (MVP)

### Application layer
- `NotificationEventType` (`packages/domain/src/enums`): `IdeaMention`, `CommentMention`, `CommentAdded`, `IdeaStatusChanged` (Issues & Delivery adds its own event types — `20-feature-issues-and-delivery.md`). *Added 2026-10-01:* `IdeaEdited`, and recipients for the follower-based types come from `idea_followers` (`20-feature-idea-following.md` "Schema change").
- A `NotificationWriter` port (`packages/application/src/notifications/models.ts`) with one operation, `notify(input)`; the input carries the event type, recipient, actor, idea id and title, board id and organization id.
- `NotificationService` implements it: it applies self-notification suppression and builds the event through the domain factory.
- The idea and comment services call it from the mention, comment, and status-move paths, each through its own narrow port.

### Infrastructure layer
- `NotificationEventRepository` (`packages/infrastructure/src/repositories/notification-event.repository.ts`) persists the events.
- Inserts one `NotificationEvent` row per recipient per event (no batching in MVP).
- Fields populated: `RecipientUserId`, `EventType`, `IdeaId`, `IdeaTitle`, `OrgId`, `TriggeredByUserId`, `Link` (`/ideas/{ideaId}`), `OccurredAtUtc`. *Added 2026-10-01:* `ReadAtUtc`, `NULL` when written; `StatusName`, the new status's name for the two status events, captured at write time (`20-feature-idea-following.md` rule 37).
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
- [ ] The idea and comment services call the writer for all four trigger events (six since
      2026-10-01: add promotion/delivery status and `IdeaEdited`)
- [ ] Self-notifications are suppressed (actor == recipient → no event written)
- [ ] Each emitted event's `Link` field stores `/ideas/{ideaId}`
- [ ] No SMTP, email client, or outbound HTTP code is present in the notification path
- [ ] Notification events do not require read or query API endpoints in MVP — *superseded 2026-10-01:*
      the inbox routes in `contracts/notifications.md` read and mark the caller's own events
- [ ] Email delivery and per-user preferences remain deferred outside MVP
