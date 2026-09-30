# Contracts: health

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Health Contract

Written from the code 2026-09-29 (slice 134): the route was served and recorded by the golden
corpus (`health.health.*`, all five roles) but never documented.

### `GET /api/v1/health`
Liveness probe.

- **Roles:** anyone, anonymous included — the route carries no authentication at all.
- **Request:** —
- **Response:** `200`:
  - `status` — always `"Healthy"`
  - `timestampUtc` — the server's current time
- **Errors:** —
- **Rules:**
  - touches no dependency, the database included, so a slow database never reports the API as down
  - answers identically whoever calls it
