# Contracts: usage analytics

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Usage Analytics Contracts

Proposed 2026-10-27 (`SPEC/20-feature-analytics.md` Part 3; `SPEC/decisions.md` 2026-10-27,
"Usage analytics records what members view, tied to their account"). Not built.

Shared rules:

- Times are ISO 8601 UTC. Periods are `from` (inclusive) and `to` (exclusive) dates; at most 90
  days for the routes that read raw events.
- "Statistics" everywhere below exclude Site Admins, events recorded under View As, and the views of
  members who have opted out.
- A visit is derived when read: a member's events with no gap longer than 30 minutes. Nothing
  stores a visit.

### `POST /api/v1/usage/events`
Record a batch of view events from the web client.

- **Roles:** any authenticated caller.
- **Request:** `{ "events": [ … ] }`, 1–50 events, body at most 16 KB. Each event:
  - `type` one of `board.viewed`, `idea.opened`, `list.viewed`, `search.run`, `filter.applied`,
    `admin.viewed`, `settings.viewed`
  - `occurredAtUtc` the browser's time
  - `route` the route template, e.g. `/boards/[id]`
  - `entityId` GUID or `null` (`boardId` for `board.viewed`, `ideaId` for `idea.opened`)
  - `props` object or `null`, only the keys the event table in the spec lists, scalar values or
    arrays of short strings: `source`, `list`, `scope`, `resultCount`, `filterKeys`, `screen`
- **Response:** always `202` `{ "accepted": n }`, where `n` is how many events were stored.
- **Errors:** `401` only. **A deliberate exception to the validation convention:** a malformed
  batch, a malformed event, an unknown `type` or `props` key, an oversized body, a rate-limited
  batch, an opted-out caller, a Site Admin acting directly, `COLLEGA_USAGE_TRACKING=off` and a
  failed write are all `202` with the events not stored. The client ignores the response, and an
  error status would only add noise to the browser console.
- **Rules:**
  - The server sets `user_id`, `organization_id` and `on_behalf_of_user_id` from the session; the
    body never carries an identity.
  - An `occurredAtUtc` more than 24 hours from the server's clock is replaced by the server's time.
  - At most 60 batches a minute per user; batches over that are dropped.
  - One insert per batch, with a 2-second statement timeout. A failure is written to the console as
    one JSON line, `{ "tag": "usage_events_write_failed", "userId", "organizationId", "events",
    "error" }`, and the response is still `202`.

### `GET /api/v1/usage/tracking`
### `PUT /api/v1/usage/tracking`
Read or set the caller's own "Record how I use Collega" switch.

- **Roles:** any authenticated caller, for themselves only. Under View As, `403`: the switch
  belongs to the user.
- **Request (`PUT`):** `{ "enabled": boolean }`.
- **Response:** `200` `{ "enabled": boolean }`. Default `true`.
- **Errors:** `400` keyed `enabled`; `401`; `403`.
- **Rules:** stored as `users.usage_tracking_opt_out` (the inverse). Takes effect on the caller's
  next batch. Turning it off deletes nothing. Audited as `UsageTrackingChanged` with `{ enabled }`.

### `GET /api/v1/usage/organizations/{organizationId}/overview`
The Overview tab.

- **Roles:** Site Admin acting directly. (The Org Admin view, later, is its own contract change.)
- **Request:** query `from`, `to`, optional `role` (`OrgAdmin`, `User`, `ReadOnly`).
- **Response:** `200`:
  - `totals`: `{ activeMembers, members, views, changes, visitsPerActiveMemberPerWeek }`
  - `milestones`: an array, in order, of `{ key, reachedAtUtc | null, daysSinceCreated | null }`
    for `organizationCreated`, `firstBoardByPerson`, `firstIdea`, `firstComment`,
    `thirdActiveMember`, `firstIdeaInFinalLane`. Whole history, not the period.
  - `weeklyActive`: `[ { week, activeMembers } ]` from the organization's first active week, at most
    the last 26 weeks; `members` above is the denominator.
  - `featureUse`: `[ { event, kind: "view" | "change", count, people, byRole: { OrgAdmin, User,
    ReadOnly } } ]`, views from `usage_events`, changes from `audit_events`.
  - `dailyOnly`: `true` when the period is older than retention; then `people` and `byRole` are
    `null` and `featureUse` covers views from `usage_daily` only.
- **Errors:** `400` keyed `from`, `to` or `role`; `401`; `403`; `404` organization missing.
- **Rules:** `firstBoardByPerson` is the first `BoardCreated` audit event; the board made with the
  organization (recorded in `OrganizationCreated`'s `defaultBoardId`) does not count.

### `GET /api/v1/usage/organizations/{organizationId}/paths`
The Paths tab.

- **Roles:** Site Admin acting directly.
- **Request:** query `from`, `to` (within retention), `after` (a view event type or a change event
  type), optional `role`.
- **Response:** `200` `{ total, items: [ { next, count, share, medianSecondsToNext | null } ] }`, top
  10 by count, then `left` (no further event in the visit) last, with a `null` median.
- **Errors:** `400` keyed `from`, `to`, `after` or `role`; `401`; `403`; `404`.

### `GET /api/v1/usage/users/{userId}/trail`
The Member trail tab.

- **Roles:** Site Admin acting directly.
- **Request:** query `from`, `to` (within retention), `page`, `pageSize` (standard paging, default
  50, 1–100).
- **Response:** `200` `{ items, page, pageSize, totalCount, optedOut }`, newest first. Each item:
  `{ occurredAtUtc, kind: "view" | "change" | "viewAs", event, entityType, entityId, onBehalfOfUserId
  | null, actorUserId, metadata | null }`. A client resolves names and item keys from their own
  reads.
- **Errors:** `400`; `401`; `403`; `404` user missing.
- **Rules:** when `optedOut` is `true`, only changes are returned.

### `POST /api/v1/internal/usage/rollup`
The nightly job, called by Vercel Cron.

- **Roles:** none. Authorized only by `Authorization: Bearer <CRON_SECRET>`, checked in the auth
  folder; any user token is `401`.
- **Request:** —
- **Response:** `200` `{ daysRolledUp, rowsDeleted }`.
- **Errors:** `401`.
- **Rules:** rolls up every complete UTC day older than retention not yet in `usage_daily`, replacing
  a day if run again; then deletes raw rows older than retention in batches of 10,000. Excluded
  rows (View As, opted-out) are not counted in rollups.
