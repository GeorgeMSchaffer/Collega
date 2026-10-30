# Contracts: sign-in messages

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Sign-in Message Contracts

Proposed 2026-10-27 (`SPEC/20-feature-login-messages.md`; `SPEC/decisions.md` 2026-10-27, "Admins
can post sign-in messages, system-wide or per organization"). Not built.

Shared rules for every route below:

- **System messages** (`organizationId: null`) are managed only by a Site Admin acting directly.
- **Organization messages** are managed by an Org Admin of that organization, or a Site Admin
  through View As acting as one. A Site Admin acting directly `403`; User and Read Only `403`.
- A message of another organization, or one that does not exist, is `404`.
- Validation failures are `400`, title `One or more fields are invalid.`, keyed by field.
- Times are ISO 8601 UTC.

### Message body

```json
{
  "id": "uuid",
  "organizationId": "uuid | null",
  "title": "Planned maintenance",
  "body": "Collega is read-only on Saturday 08:00–10:00 UTC.",
  "display": "Modal | Banner",
  "dismissalMode": "EveryLogin | DismissOnce | AcknowledgeRequired",
  "startsAtUtc": "2026-11-01T00:00:00Z",
  "endsAtUtc": "2026-11-08T00:00:00Z | null",
  "revision": 1,
  "state": "Scheduled | Live | Ended",
  "acknowledgedCount": 12,
  "audienceCount": 40,
  "createdAtUtc": "…",
  "updatedAtUtc": "…"
}
```

`acknowledgedCount` and `audienceCount` are present only for `AcknowledgeRequired`, for the current
revision, counting Active users in scope.

Write body (create and update): `title` (1–120 after trim), `body` (1–4,000 after trim),
`display`, `dismissalMode`, `startsAtUtc`, `endsAtUtc` (optional, after `startsAtUtc`). Update
also takes `showAgain` (boolean, default `false`); `true` raises `revision`.

### `GET /api/v1/login-messages/system` · `POST /api/v1/login-messages/system`

Site Admin acting directly. List (newest `startsAtUtc` first, collection conventions) and create.
`201` with the message.

### `GET /api/v1/organizations/{organizationId}/login-messages` · `POST` the same

Org Admin of the organization. List and create. `201` with the message.

### `GET /api/v1/login-messages/{messageId}` · `PUT` · `DELETE`

The message's manager. `PUT` returns the message; `DELETE` is `204` and removes its receipts.
Audit: `LoginMessageCreated`, `LoginMessageUpdated` (with `showAgain`), `LoginMessageDeleted`.

### `GET /api/v1/login-messages/{messageId}/acknowledgements`

The message's manager. `AcknowledgeRequired` only, else `422 acknowledgeNotRequired`. Returns
`acknowledgedCount`, `audienceCount` and a page of
`{ userId, name, email, organizationName, acknowledgedAtUtc | null }`, acknowledged first.

### `GET /api/v1/login-messages/visible`

Any signed-in user acting as themself. The live messages in the caller's scope not hidden for the
current sign-in, in display order (system first, then `startsAtUtc`, then creation):

```json
{ "items": [ { "id": "uuid", "scope": "System | Organization", "title": "…", "body": "…",
               "display": "Modal", "dismissalMode": "AcknowledgeRequired", "revision": 2 } ] }
```

During View As: `200` with `items: []`.

### `POST /api/v1/login-messages/{messageId}/close` · `/acknowledge`

Any signed-in user acting as themself, Read Only included; `403` during View As. The message must
be live and in the caller's scope, else `404`. `204`, idempotent.

- `close` on a `DismissOnce` message records the dismissal for good; on the other modes it
  records a close for the current sign-in.
- `acknowledge` is for `AcknowledgeRequired`, else `422 acknowledgeNotRequired`.
