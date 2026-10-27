# Feature: Sign-in messages

*Written 2026-10-27 (slice 357, spec) from the owner's answers, one question at a time.
Decision: `SPEC/decisions.md` 2026-10-27 "Admins can post sign-in messages, system-wide or per
organization". Contract: `SPEC/contracts/login-messages.md`, proposed. Status: **specified, not
built**.*

## Intent

Let the App Admin (Site Admin) tell every user something, and let an Org Admin tell their own
organization something, at sign-in: maintenance windows, policy changes, onboarding notes. When a
notice matters, the admin can require each user to press **Acknowledge** and can see who has.

## Scope

- **Two kinds of message:** *system* (Site Admin, reaches every user) and *organization* (Org
  Admin, reaches that organization's members).
- Per message: a **date window**, a **display** (modal or banner) and a **dismissal mode**
  (every sign-in, dismiss once, acknowledge required).
- Showing active messages on the desk; closing and acknowledging them.
- An acknowledgement report on each message: *N of M acknowledged*, and who and when.

## Non-goals

- Targeting by role, group or board. A message reaches everyone in its scope (owner, 2026-10-27).
- Markdown, HTML, images or attachments. Title and plain text only; web addresses become links.
- Seconds-on-screen auto-close, or a "next N sign-ins" limit (owner chose a date window).
- Email or Inbox delivery. A sign-in message appears only on the desk; the Inbox is unchanged.
- Messages on the sign-in page itself, before authentication.
- Localization, scheduling recurrence, message templates.

## Terms

| Term | Meaning |
|---|---|
| **System message** | `organizationId = null`. Managed by a Site Admin acting directly. Reaches every user, Site Admins included. |
| **Organization message** | Belongs to one organization. Managed by its Org Admin (or a Site Admin through View As). Reaches that organization's users. |
| **Window** | `startsAtUtc` (required) to `endsAtUtc` (optional, exclusive). A message is **live** when `startsAtUtc ≤ now` and (`endsAtUtc` is null or `now < endsAtUtc`). |
| **Display** | `Modal` (a dialog over the page) or `Banner` (a strip above the content). Chosen per message. |
| **Dismissal mode** | `EveryLogin`: closing hides it until the user next signs in. `DismissOnce`: closing hides it for good. `AcknowledgeRequired`: only **Acknowledge** hides it for good; closing hides it until the next sign-in. |
| **Sign-in** | One `POST /auth/login`. The session token is never refreshed, so its issued-at time (`iat`) identifies the sign-in; View As does not change it. |
| **Receipt** | A user's record against a message: when they last closed it, dismissed it, acknowledged it, and for which revision. |
| **Revision** | An integer on the message, raised when an admin saves with *Show again to everyone*. A receipt for an older revision counts as no receipt. |

## Requirements

Each requirement has scenarios and an oracle. IDs are stable; later slices cite them.

### LMS-1 Site Admins manage system messages — Added

- **1a** A Site Admin acting directly lists, creates, edits and deletes system messages.
- **1b** Anyone else is refused system-message reads and changes: `403`. A Site Admin in View As
  is acting as the target and is refused too.
- **1c** Fields: `title` (required, trimmed, 1–120 characters), `body` (required, trimmed, 1–4,000
  characters, line breaks kept), `display`, `dismissalMode`, `startsAtUtc` (required; may be in
  the past), `endsAtUtc` (optional; must be after `startsAtUtc`). Failures are `400` keyed by field.
- **1d** Every create, edit and delete writes an audit event (`LoginMessageCreated`,
  `LoginMessageUpdated`, `LoginMessageDeleted`) carrying the message id and scope.

*Oracle:* `LoginMessageService` tests; API tests per route × the four roles.

### LMS-2 Org Admins manage their organization's messages — Added

- **2a** An Org Admin lists, creates, edits and deletes their own organization's messages, with
  the same fields, validation and audit as LMS-1.
- **2b** User and Read Only members are refused list and change: `403`. A message of another
  organization, or one that does not exist, is `404`.
- **2c** A Site Admin acting directly is refused organization-message changes (`403`); View As is
  the path, as for groups and tags.

*Oracle:* service tests; API tests per route × role, including the cross-organization `404`.

### LMS-3 A user sees the live messages in their scope — Added

- **3a** On every desk page render, the user is shown each **live** message in their scope (system
  messages, plus their organization's if they have one) that is not hidden by LMS-4.
- **3b** Order: system before organization; within each, earlier `startsAtUtc` first, then earlier
  creation.
- **3c** `Modal` messages show one at a time in that order; the next opens when the current one is
  closed or acknowledged. `Banner` messages stack above the page content, below the View As
  banner, in the same order. Banners show while modals are open.
- **3d** A message whose window opens after the user signed in appears on their next page load;
  one whose window closes disappears on their next page load.
- **3e** Editing a message's text without *Show again to everyone* changes what a user sees next
  time it shows, and does not bring back a message they had hidden.
- **3f** While a Site Admin is in View As, no message is shown, and close and acknowledge are
  refused (`403`). An admin must not dismiss or acknowledge on someone else's behalf.

*Oracle:* service tests for the visible-set rule over a fixed clock; web tests for ordering and
stacking; the Playwright spec for a modal then a banner.

### LMS-4 Closing, dismissing and acknowledging — Added

Let `s` be the time of the current sign-in and `r` the user's receipt for the message's current
revision (if any). A message is **hidden** when any of these holds:

- `r.acknowledgedAtUtc` is set;
- the mode is `DismissOnce` and `r.dismissedAtUtc` is set;
- `r.closedAtUtc ≥ s` (closed during this sign-in).

- **4a** `EveryLogin`: the control is **Close**. Closing records `closedAtUtc`. It shows again
  after the next sign-in while live.
- **4b** `DismissOnce`: the control is **Dismiss** (the same close route). It records
  `dismissedAtUtc` and the message never shows again for this revision.
- **4c** `AcknowledgeRequired`: the controls are **Acknowledge** and **Close** (a modal's Escape
  key and ✕ are Close). Close records `closedAtUtc` only; it returns after the next sign-in.
  Acknowledge records `acknowledgedAtUtc` and it never shows again for this revision.
- **4d** Acknowledge on a message that is not `AcknowledgeRequired` is `422 acknowledgeNotRequired`.
  Close or acknowledge on a message outside the caller's scope, or not live, is `404`.
- **4e** Read Only users may close, dismiss and acknowledge; a receipt is not content.
- **4f** Repeating an action is idempotent: the first `acknowledgedAtUtc` and `dismissedAtUtc`
  are kept; `closedAtUtc` takes the latest time.

*Oracle:* service tests per mode, with sign-in times before and after the receipt.

### LMS-5 Show again to everyone — Added

- **5a** Saving an edit with `showAgain: true` raises the message's revision. Every user's
  receipt for the old revision stops counting, so the message shows again to everyone in scope,
  and the acknowledgement report starts from zero.
- **5b** Saving with `showAgain: false` (the default) keeps the revision.
- **5c** The edit form shows the option as a checkbox, *Show again to everyone*, unticked.

*Oracle:* service test: acknowledge, edit with and without `showAgain`, check visibility and report.

### LMS-6 Acknowledgement report — Added

- **6a** For an `AcknowledgeRequired` message, its manager can read *N of M acknowledged* for the
  current revision, where M is the count of **Active** users in scope now and N those of them
  with an acknowledgement.
- **6b** The same read lists those users (name, email, organization for a system message,
  acknowledged at, or *not yet*), acknowledged first, paged per the collection conventions.
- **6c** An Org Admin sees only their organization's users; only a Site Admin sees the system
  report.
- **6d** For other modes the report is `422 acknowledgeNotRequired`.

*Oracle:* service and API tests; a seeded fixture with two organizations.

### LMS-7 Web: Settings → Sign-in messages — Added

- **7a** A Site Admin sees *Settings → Sign-in messages* with the system messages; an Org Admin
  sees the same page with their organization's messages. Others see no entry, and the route
  shows the standard refusal.
- **7b** The list shows title, display, mode, window and state (*Scheduled*, *Live*, *Ended*), and
  for `AcknowledgeRequired` the *N of M* count.
- **7c** Create and edit use the list-and-drawer pattern (comp R): title, body, display (radio),
  mode (radio with one-line explanations), start and optional end (local date-time, stored UTC),
  *Show again to everyone* on edit, and a preview of the modal or banner. Delete asks to confirm.
- **7d** The drawer of an `AcknowledgeRequired` message has an *Acknowledgements* section with the
  LMS-6 report.
- **7e** End now: an action on a live message that sets `endsAtUtc` to now.

*Oracle:* approved comp; web unit tests; Playwright spec; browser check on desktop and 375px,
Graphite and Terrazzo.

## Design

**The fact that makes this safe:** only `POST /auth/login` issues a session token and nothing
refreshes it, so the token's `iat` is a stable sign-in time. "Hidden until the next sign-in" is a
comparison of the receipt's `closedAtUtc` with that time: no session table and no per-session
row. The principal resolved by `TokenAuthenticationService` gains `signedInAtUtc` (from `iat`), and
`CurrentUserContext` exposes it. *Found while building 358:* the signer passed `noTimestamp`, which makes
jsonwebtoken drop `iat`, so tokens carried only `sub`, `sstamp` and `exp`. The signer now keeps the
explicit `iat` from the injected clock; a token issued before that has none, and its holder sees a
closed message again only after their next sign-in. Everything else is additive: two new tables, new routes, a new
desk component; no existing response changes.

**Persistence** (an S0.2 amendment, numbered when its migration merges):

```
enum LoginMessageDisplay   { Modal  Banner }
enum LoginMessageDismissal { EveryLogin  DismissOnce  AcknowledgeRequired }

login_messages           id uuid PK, organization_id uuid NULL FK CASCADE,
                         title varchar(120), body varchar(4000),
                         display LoginMessageDisplay, dismissal_mode LoginMessageDismissal,
                         starts_at_utc timestamptz, ends_at_utc timestamptz NULL,
                         revision int NOT NULL DEFAULT 1,
                         created/updated_at_utc, created/updated_by_user_id
                         CHECK (ends_at_utc IS NULL OR ends_at_utc > starts_at_utc)
                         INDEX (organization_id, starts_at_utc)
login_message_receipts   message_id FK CASCADE, user_id FK CASCADE, PK (message_id, user_id),
                         revision int, closed_at_utc timestamptz NULL,
                         dismissed_at_utc timestamptz NULL, acknowledged_at_utc timestamptz NULL
```

One receipt row per user and message, overwritten when its revision is old: the report and the
visible set are plain joins, and *Show again* is one `UPDATE … SET revision = revision + 1`.

**Application:** `packages/domain/src/login-messages` (the entity, field rules, `isLive(now)`,
`isHiddenFor(receipt, signedInAt)`); `packages/application/src/login-messages`
(`LoginMessageService` with manage, `listVisible`, `close`, `acknowledge`, `report`;
authorization by scope as in LMS-1/2); a Prisma repository in infrastructure. The clock is
injected.

**Web:** the desk layout fetches the visible set once per render and passes it to a client
`<LoginMessages>` beside `ViewAsBanner`: banners in the column, modals through the design-system
dialog. Close and acknowledge are server actions that call the API and refresh.

**Rejected:** (a) a session table to track "this sign-in": a schema change to auth for one
comparison the token already supports; (b) receipts deleted on *Show again*: loses the old
revision's history in one step and costs a bulk delete; (c) browser storage for closes: does not
follow the user across devices and cannot back an acknowledgement.

## Requirement → task → evidence map

| Req | Slice | Evidence |
|---|---|---|
| LMS-1, LMS-2 | 358 | `LoginMessageService` manage tests; API tests per route × 4 roles; migration assertion |
| LMS-3, LMS-4 | 359 | visible-set tests over a fixed clock and sign-in times; API tests for close and acknowledge, View As refusal |
| LMS-5, LMS-6 | 359 | revision tests; report tests with two organizations |
| LMS-1–6 | 360 | QA API suite; `pnpm check` |
| LMS-7 | 361–363 | comp approved; web tests; `e2e/tests/login-messages.spec.ts`; browser check |
| LMS-3 (UI) | 362, 363 | web tests for order and stacking; Playwright: modal then banner, acknowledge survives sign-out |

## Slice plan

Sequential except where noted. Each backend slice starts with failing tests for its requirements.

| Slice | Role | Outcome | Owns | Depends on |
|---|---|---|---|---|
| **357** | Spec | This file; decision entry; `contracts/login-messages.md` (proposed) and its index row; tracker row | `SPEC/` | — |
| **358** | Backend | `iat` kept in the session token; migration for both tables and enums; domain entity and rules; `LoginMessageService` manage half; routes `GET/POST /login-messages/system`, `GET/POST /organizations/{orgId}/login-messages`, `GET/PUT/DELETE /login-messages/{id}`; audit; demo seed adds one ended system banner and one scheduled org modal (none live, so no e2e run meets one) | domain, application, infrastructure `login-messages`, api `login-messages.controller.ts`, migration | 357 |
| **359** | Backend | `signedInAtUtc` on the principal and `CurrentUserContext`; `GET /login-messages/visible`; `POST …/{id}/close`, `/acknowledge`; `showAgain` on `PUT`; `GET …/{id}/acknowledgements` | application `auth` (principal only), `login-messages`, infrastructure repo, api controller | 358 |
| **360** | QA | API suite per role and mode; visible-set table over the clock; View As refusal | `apps/api` tests | 359 |
| **361** | UI/UX | Throwaway comp: the modal, the banner stack, the Settings list and drawer with report; owner approves | `SPEC/mockups/comp-r-login-messages.html` | 357 (may run beside 358–360) |
| **362** | UI | Settings → Sign-in messages page and drawer; `<LoginMessages>` in the desk layout; server actions | `apps/web` | 359, 361 |
| **363** | QA | Web unit tests; `e2e/tests/login-messages.spec.ts`; browser check | `apps/web` tests, `e2e/` | 362 |

Code Reviewer gates each slice before it merges into `dev`. Slice 362 edits the desk layout, whose
header comment says screens render into it rather than edit it; the edit is one component beside
`ViewAsBanner` and is within the shell's own concern.

## Verification commands

```bash
pnpm --filter @collega/infrastructure db:migrate
pnpm --filter @collega/infrastructure db:seed
pnpm --filter @collega/domain test
pnpm --filter @collega/application test
pnpm --filter @collega/api test
pnpm check
pnpm test:e2e -- login-messages
```

## Assumptions and open points

- **Decided by default, confirm on review:** no messages during View As, and close/acknowledge
  refused there (LMS-3f).
- **Decided by default, confirm on review:** a message that goes live mid-session appears on the
  next page load, not only at the next sign-in (LMS-3d).
- **Decided by default, confirm on review:** delete is a hard delete and removes its receipts;
  *End now* is the way to stop a message and keep its acknowledgements.
- **Decided by default:** Site Admins have no organization, so they see system messages only.
- **Not affected:** the golden corpus (new routes only) and the MCP server (no message tools).
