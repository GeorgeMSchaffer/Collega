# Feature: Following an Idea, and the Notification Inbox

> **At a glance** (added 2026-10-01; the text below wins where they differ)
> - **Scope:** anyone who can see an idea follows or unfollows it for themselves; followers are notified of
>   comments, status changes, promotion and edits; notifications are read in an in-app inbox with an unread
>   count. Email, preferences and digests are out (rules 33–35).
> - **Key rules:** following is a read and grants nothing, and nobody follows on someone else's behalf (1–3);
>   the author and each assignee follow automatically and may unfollow (4–8); followers replace "author +
>   assignee" as the recipients of comment and status events, and a new `IdeaEdited` event covers edits and
>   reassignment (9–17); one row per person per action, self-suppressed (18–19); the inbox is the caller's
>   own, newest first, paged, marked read one at a time or all at once, 90 days shown (20–29); under View As
>   it is the target's inbox (30–32).
> - **Contracts:** contracts/following.md, contracts/notifications.md, contracts/ideas.md (`GET /ideas/{ideaId}`)
> - **Decisions:** 2026-10-01 "Following an idea, and an in-app notification inbox"; 2026-10-01 "The S0.2
>   schema freeze is amended a fifth time, for idea followers and read state"
> - **Comp:** `SPEC/mockups/comp-r-inbox.html` — awaiting the user's review; the UI is not built until it is
>   approved.
> - **The defaults this slice proposed were answered by the user on 2026-10-01** ("Answered 2026-10-01"
>   below); each is marked *(answered, Qn)* where it applies. Q13 differs from the proposal: status rows
>   name the new status.

## Outcome

A person can keep up with the ideas they care about without being the author or an assignee, and finds
what happened in one place: an inbox reached from the sidebar, with an unread count. The events
Collega already records (`20-feature-notifications.md`) gain a reader.

## Rules

### Following

1. **Anyone who can see an idea can follow or unfollow it for themselves** — User, Org Admin and Read
   Only alike, and a Site Admin acting through View As (decision 2026-10-01, item 1).
2. **Following is a read.** It grants no access and changes nothing about the idea: no audit event, no
   change to `updated_at_utc`, and no notification to anyone. *(answered, Q7: not audited.)*
3. **Nobody follows or unfollows on someone else's behalf.** There is no route that names another user,
   and no Org Admin override (decision 2026-10-01, item 1).
4. **The author follows automatically when the idea is created**, by every creation path: the form, the
   idea assistant and CSV import (decision 2026-10-01, item 2).
5. **Each assignee follows automatically when they are added** — at creation or by a later change to
   the assignee collection. Adding someone who already follows changes nothing.
6. **Anyone who follows automatically can unfollow**, and stays unfollowed: later edits, comments or
   status changes do not re-follow them. Being **newly added** as an assignee again does.
7. **Removing an assignee does not unfollow them.** They keep following until they choose to unfollow,
   and so receive the reassignment that removed them (rule 12). *(answered, Q1.)*
8. **A Site Admin acting as themselves cannot follow** (`403`, the same guard as upvoting:
   `20-feature-view-as.md` rule 25). They are not a member of the organization and are never a
   recipient (rule 19). They follow through View As, as the target. *(answered, Q6.)*

### Who is notified

9. **Followers are notified of** a new comment, a status change, promotion to an issue, and an edit or
   reassignment (decision 2026-10-01, item 3).
10. **Comment added (`CommentAdded`) and status change (`IdeaStatusChanged`):** every follower. This
    replaces "idea author + idea assignee" in `20-feature-notifications.md`. The lane-removal exception
    stands: a board save that moves ideas off a removed lane notifies no one
    (`20-feature-boards-and-statuses.md` rule 14).
11. **Promotion (`IdeaPromoted`):** every follower, replacing "idea author + assignees" in
    `20-feature-issues-and-delivery.md`. **A delivery-status move (`IssueDeliveryStatusChanged`)** is
    read as a status change and also goes to every follower. *(answered, Q3.)*
12. **Edit or reassignment — new event type `IdeaEdited`:** every follower, once per save that changes
    something. It is written by `PUT /ideas/{ideaId}` when any field it carries changes (content,
    priority, type, impact, due date, assignees, tags, mentions, effort), and by the admin's Idea Type
    reassignment (`PUT /organizations/{organizationId}/ideas/{ideaId}/idea-type`). One event per save,
    not one per field; a save that changes nothing writes none. Assignees added by that save are
    followers by the time the event is written (rule 5), so they receive it. One type covers both edits
    and reassignment, as the decision names one new type. *(answered, Q2.)*
13. **Unchanged:** an idea mention (`IdeaMention`) and a comment mention (`CommentMention`) go to the
    mentioned person only, whether or not they follow; a task assignment (`IssueTaskAssigned`) goes to
    the task's new assignee only. Mentioning someone does not make them follow.
14. **Not notified:** following and unfollowing, upvotes, return to Discovery, sprint assignment, task
    changes other than assignment, and soft deletion.
15. **Commenting does not make the commenter follow.** The decision names only the author and assignees.
    *(answered, Q4.)*
16. **Followers are read when the event is written**, in the same request as the change that caused
    it, right after that change commits, as notifications are today.
17. **No event is written for a soft-deleted idea** — none of the triggering actions is possible on one.

### One row per person

18. **One row per recipient per action.** When a person qualifies twice for one action — mentioned in a
    comment and following the idea, say — they get the more specific row: the mention. Today's code can
    write both. *(answered, Q5.)*
19. **Self-notifications stay suppressed:** nobody is notified of their own action, whether or not they
    follow. Under View As, "own" means the target, the identity the action is recorded as
    (`20-feature-view-as.md` rule 15).

19a. **A deactivated account is notified of nothing** — not as a follower, not when mentioned, not as a
    task's assignee. Its follow rows stay; reactivated, it is notified again from then on, and nothing
    written while it was inactive is backfilled. *(Owner decision 2026-10-01.)*

### The inbox

20. **The inbox is the caller's own notifications**, nobody else's, by `recipient_user_id`. There is no
    route that reads another person's inbox.
21. **Newest first** by `occurredAtUtc`, then by id, so paging is stable.
22. **Paged** with the shared paging convention (`30-Contracts.md`): `page`, `pageSize` (absent is `20`,
    clamped to 1–100). The screen uses the list pattern's pager: 10 a page by default, 25, 50 or 100.
23. **Each row** names the actor, what happened, the idea's title as it was when the event was written,
    when, and whether it is unread. **Status rows name the new status** — the lane, or the delivery
    status — as it was named when the event was written (rule 37). *(answered, Q13.)*
23a. **A row names the idea's board.** The sub-line reads *{reason} · {board name}* (*You follow this
    idea · Opportunities*), or just the reason when the board cannot be resolved. The name is the idea's
    **current** board, read when the inbox is listed, not the board when the event was written, so it
    stays correct after a move. No schema change: `ideas.board_id`. *(owner's decision, 2026-10-01.)*
24. **The unread count** is the number of the caller's unread notifications within the window
    (rule 26). The sidebar shows it as a badge, capped at `99+`.
25. **Marking read.** Opening a row marks that one read. **Mark all read** marks every unread
    notification of the caller's read. Both are idempotent: a row already read keeps its first
    `readAtUtc`. Nothing marks a notification unread again.
26. **Retention: the inbox shows the last 90 days.** Older notifications stay in the table and are
    neither listed nor counted. Deleting them is a later job, not this feature. *(answered, Q8.)*
27. **A soft-deleted idea's notifications are hidden** from the list and the count.
    *(answered, Q9.)*
28. **What a row opens.** Every event stores the canonical link `/ideas/{ideaId}`
    (`20-feature-notifications.md`). On the inbox screen a row opens the idea drawer **over the inbox**
    (`/inbox?idea={ideaId}`, the list and detail pattern's URL rule), so working down the list keeps
    its place; the stored link is what any later channel, such as email, uses. *(answered, Q10.)*
29. **Opening an idea any other way does not mark its notifications read.** Only opening the row does.
    *(answered, Q11.)*

### View As

30. **Acting as someone shows the target's inbox and unread count.** `CurrentUserContext` reports the
    target (`20-feature-view-as.md` rule 4); nothing special-cases it.
31. **Marking read while acting marks the target's notifications read**, because View As is act-as, not
    preview (rule 24 there). Read state is not audited, so this leaves no trail. *(answered, Q12.)*
32. **A Site Admin acting as themselves has no inbox.** They are never a recipient (rule 8), so the
    sidebar item is hidden for them, as Home gives them a roll-up instead. *(answered, Q6.)*

### Out of scope

33. **Email.** Comes later, once a provider is configured; guaranteed delivery stays deferred
    (decision 2026-10-01, item 4; `20-feature-notifications.md` "Delivery Rules (later phase)").
34. **Preferences and digests:** no per-type or per-idea settings, no muting, no summaries. Unfollowing
    is the only control.
35. **Not in this feature:** a list of who follows an idea, following a board, an organization activity
    feed, snooze or archive, marking unread, real-time push. These are in `ideas-inbox.md` § "Loop" and
    stay unscheduled.

## Schema change (proposal)

Amends the S0.2 freeze a fifth time (`SPEC/decisions.md` 2026-10-01, "The S0.2 schema freeze is amended
a fifth time, for idea followers and read state"). The build slice writes the Prisma migration; this is
its specification.

36. **New table `idea_followers`**, shaped like `idea_upvotes` and `idea_assignees`:

    | Column | Type | Notes |
    |---|---|---|
    | `id` | `UUID` | primary key `PK_idea_followers` |
    | `idea_id` | `UUID NOT NULL` | `FK_idea_followers_ideas_idea_id` → `ideas(id)` **`ON DELETE CASCADE`** |
    | `user_id` | `UUID NOT NULL` | `FK_idea_followers_users_user_id` → `users(id)` **`ON DELETE RESTRICT`**, matching `idea_upvotes` and `idea_assignees` |
    | `created_at_utc` | `TIMESTAMPTZ(6) NOT NULL` | when they started following, from the injected clock |

    - Unique `ux_idea_followers_idea_id_user_id` on (`idea_id`, `user_id`): one row per person per idea,
      and the index the follower count and the fan-out read.
    - Index `IX_idea_followers_user_id` on (`user_id`), for the foreign key.
    - Unfollowing deletes the row. Ideas are only soft-deleted, so the cascade matters only to a hard
      delete such as a test reset.
37. **`notification_events` gains two nullable columns:**
    - `read_at_utc TIMESTAMPTZ(6) NULL` — `NULL` is unread.
    - `status_name VARCHAR(100) NULL` — the new status's name, captured **when the event is written**:
      the lane's `statuses.name` (same length) for `IdeaStatusChanged`, and the delivery status
      (`Pending`, `Scoping`, `Development`, `Review`, `Complete`) for `IssueDeliveryStatusChanged`.
      `NULL` for every other type, and for events written before the migration. A later rename of the
      status does not rewrite it: the row says what the person was told at the time. *(answered, Q13.)*
    - **Why a narrow column, not JSON metadata:** only the two status events need a detail. `IdeaEdited`
      says *edited*, since one save can change many fields and the drawer shows the result; mentions,
      comments, promotion and tasks need nothing beyond the actor and the title already stored. A typed
      column is checked by the schema and costs no parsing; a metadata column would wait for a type
      that needs it, under its own amendment.
    - New index `ix_notification_events_recipient_user_id_occurred_at_utc` on (`recipient_user_id`,
      `occurred_at_utc` DESC), serving the list, the count and the 90-day window. It makes
      `ix_notification_events_recipient_user_id` redundant, and the migration drops that one.
38. **`NotificationEventType` gains `IdeaEdited`** (value 7), after `IssueTaskAssigned`, in the Prisma
    enum and in `packages/domain/src/enums`.
39. **Backfill.** The migration makes the author and every current assignee of each idea that is not
    soft-deleted a follower, so existing ideas keep today's recipients:

    ```sql
    INSERT INTO idea_followers (id, idea_id, user_id, created_at_utc)
    SELECT gen_random_uuid(), followed.idea_id, followed.user_id, now()
    FROM (
        SELECT i.id AS idea_id, i.author_user_id AS user_id
        FROM ideas AS i
        JOIN users AS author ON author.id = i.author_user_id
        WHERE i.is_deleted = FALSE
        UNION
        SELECT ia.idea_id, ia.user_id
        FROM idea_assignees AS ia
        JOIN ideas AS i ON i.id = ia.idea_id
        WHERE i.is_deleted = FALSE
    ) AS followed;
    ```

    The `JOIN users` is there because `ideas.author_user_id` has no foreign key. Existing notifications
    stay unread (`read_at_utc` `NULL`). The demo seed creates the same follower rows through the
    application's own rules, since the target database is seeded fresh.

## UI

Comp-first: `SPEC/mockups/comp-r-inbox.html` (comp R's look, Terrazzo by default, the theme picker). The
UI waits for the user's approval of the comp.

40. **Sidebar.** An **Inbox** item with a bell icon heads the Workspace group, after Home. While anything
    is unread it carries a count badge (`99+` at most); its accessible name is *Inbox, {n} unread*. The
    count refreshes on every navigation and every 60 seconds while the tab is visible — there is no
    push channel on serverless. *(answered, Q14.)*
41. **`/inbox` screen**, on the list pattern: H1 *Inbox* and a one-line description, **Mark all read** as
    the page action (disabled with its reason when nothing is unread), the rows, then the pager. No
    filters or sorting: there is one order.
42. **A row** shows the actor's avatar, *{Actor} {did what} {idea title}*, a "why" line (*You follow this
    idea*, *You were mentioned*, *Assigned to you*), and the time. Wording per type:

    | Event | Row | Why |
    |---|---|---|
    | `IdeaMention` | mentioned you in {title} | You were mentioned |
    | `CommentMention` | mentioned you in a comment on {title} | You were mentioned |
    | `CommentAdded` | commented on {title} | You follow this idea |
    | `IdeaStatusChanged` | moved {title} to {statusName} | You follow this idea |
    | `IdeaPromoted` | promoted {title} to an issue | You follow this idea |
    | `IssueDeliveryStatusChanged` | moved {title} to {statusName} in delivery | You follow this idea |
    | `IssueTaskAssigned` | assigned you a task on {title} | Assigned to you |
    | `IdeaEdited` | edited {title} | You follow this idea |

    A status row written before the migration has no `statusName`, and reads *changed the status of
    {title}* (or *the delivery status*).

43. **Unread marking follows the existing colour rule** (`20-feature-client-ui.md` "Color palette":
    chromatic values are fills, never meaning alone): an unread row has a filled **ink** dot, a 3px
    ink rule on its left edge, a semibold title and the text *Unread* for screen readers. The sidebar
    badge is an ink pill. No accent hue is used for unread state, so the colour rule is not bent; the
    accent variant `ideas-inbox.md` describes was considered and rejected. *(answered, Q15.)*
44. **Empty state:** *You're all caught up.* with one line on what lands here — *Comments, status changes
    and edits on ideas you follow, and anything that mentions you.*
45. **The follow control** sits in the idea drawer's view mode, in the Discussion section beside the
    upvote button. The drawer is the detail view — `/ideas/{ideaId}` opens it — so there is no second
    place. It is a toggle button, `aria-pressed`:
    **Follow** (outline) or **Following** (pressed) with the follower count — *Following · 4*, accessible
    text *4 people follow this idea*. It saves immediately, with no confirmation.
    *(answered, Q16: the count shows; the names do not.)*
46. A Site Admin acting as themselves sees the control **disabled with the reason** *Follow through
    View As* (the Denied rule). Read Only sees it live.
47. Idea list rows and board cards do not show follow state.

## Build split (proposed)

After this slice is reviewed: **backend** (the migration, `idea_followers` repository, the fan-out
change, `IdeaEdited`, the follow and inbox routes, `isFollowing` and `followerCount` on the idea
detail, the seed, and the golden differences recorded in `tools/golden/src/accepted.ts`), then **QA**
for it, then **UI** once the user approves the comp.

## Acceptance criteria

- [ ] Any member who can see an idea, Read Only included, can follow and unfollow it for themselves; no
      route follows or unfollows anyone else
- [ ] A Site Admin acting as themselves is refused `403`; through View As they follow as the target
- [ ] The author follows on creation by every path, and each assignee on being added; both can unfollow
- [ ] An unfollowed author or assignee is not re-followed by later edits; being newly assigned re-follows
- [ ] Removing an assignee leaves them following
- [ ] Comment, status-change, promotion and delivery-status events go to every follower, and no longer
      to a non-following author or assignee
- [ ] `IdeaEdited` is written once per changing save of `PUT /ideas/{ideaId}` and of the Idea Type
      reassignment, and not for a save that changes nothing
- [ ] Mentions and task assignment keep their own recipients
- [ ] A person qualifying twice for one action gets one row, the mention; the actor gets none
- [ ] The lane-removal exception still notifies no one
- [ ] The inbox lists only the caller's notifications from the last 90 days, newest first, paged, and
      hides a soft-deleted idea's notifications
- [ ] The unread count matches the unread rows the list would return
- [ ] Marking one read and marking all read are idempotent and keep the first `readAtUtc`
- [ ] Under View As the inbox and count are the target's
- [ ] `GET /ideas/{ideaId}` carries `isFollowing` and `followerCount`
- [ ] Status and delivery-status events store the new status's name at write time; renaming the
      status afterwards leaves the stored name unchanged
- [ ] The migration backfills the author and assignees of every live idea, and existing notifications
      are unread
- [ ] No email, SMTP or outbound HTTP is added to the notification path

## Answered 2026-10-01

The user answered the sixteen questions this slice left open on 2026-10-01 (`SPEC/decisions.md`
2026-10-01, "Following an idea, and an in-app notification inbox"). Fifteen take the recommended
answer; Q13 does not.

1. **Q1 — Removing an assignee:** they keep following.
2. **Q2 — Edit event types:** one new type, `IdeaEdited`, for edits and reassignment.
3. **Q3 — Delivery-status moves:** go to followers, as a status change.
4. **Q4 — Commenting:** does not make the commenter follow.
5. **Q5 — Duplicates:** one row per person per action; a mention plus a follow gives the mention.
6. **Q6 — A Site Admin as themselves:** cannot follow (`403`) and has no inbox; they follow only
   through View As.
7. **Q7 — Auditing:** following, unfollowing and read state are not audited.
8. **Q8 — Retention:** the inbox lists and counts the last 90 days; older rows are kept.
9. **Q9 — Deleted ideas:** their notifications are hidden.
10. **Q10 — Opening a row:** opens the drawer over the inbox, `/inbox?idea={ideaId}`.
11. **Q11 — Marking read:** only opening a row from the inbox marks it read, plus **Mark all read**.
12. **Q12 — View As:** the inbox is the target's, and marking read applies to the target.
13. **Q13 — Status rows (differs from the proposal):** the row **names the new status** — *moved {idea}
    to In Review*. `notification_events` gains `status_name VARCHAR(100) NULL`, captured at write
    time, so a later rename does not rewrite history (rule 37).
14. **Q14 — Refresh:** the unread count refreshes on each navigation and every 60 seconds while the
    tab is visible.
15. **Q15 — Unread colour:** an ink dot and bold text, no hue. No bend of the colour rule.
16. **Q16 — Follower count:** the toggle shows the count only (*Following · 4*); names are not listed.

Added after the build slice's review, also 2026-10-01: **deactivated users get no notifications**
(rule 19a). Follow rows stay, and a reactivated user is notified again from that point on.
