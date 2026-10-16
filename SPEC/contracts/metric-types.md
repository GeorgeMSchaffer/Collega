# Contracts: metric types

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Metric Type Contracts

*Written 2026-10-16 with the decision "Metric types are an organization table with projected and
realized values per item" (`SPEC/decisions.md`), before the code. It settles the value half of the
Board References rollup (`SPEC/20-feature-board-references.md`, "Value"; `contracts/outcomes.md`,
"Rollup shape").*

A **metric type** is an organization-scoped, archivable kind of value an item can carry, such as
"Annual savings" in `$` or "Hours saved" in `hours`. An item carries at most one **value** per
type, holding a **projected** and a **realized** number. Outcomes sum the values of their grouped
items per type.

Shared by every route below:
- **Roles.** Reading the types is open to every member of the organization, `Read Only` included.
  Managing them (create, update, archive, restore) is an in-scope Org Admin's; User and Read Only
  are refused with `403`. An item's values are written by whoever may edit the item (its author or
  an Org Admin, never Read Only). **A Site Admin acting directly is refused with `403` on every
  route, reads included**, and works only through View As, as for Outcomes (`contracts/outcomes.md`).
- **Item fields** (returned by every route that returns a metric type):
  - `metricTypeId`
  - `organizationId`
  - `name` string, required, non-empty, max 80 characters; **names may duplicate**, there is no
    uniqueness rule
  - `unit` string or `null`, max 20 characters, free text shown beside the number (`$`, `hours`)
  - `isArchived` boolean
  - `createdAt`, `updatedAt`
- **Numbers.** `projected` and `realized` are decimal numbers or `null`, negatives allowed, at most
  two decimal places and an absolute value below 10^15 (stored `numeric(17,2)`). They are sent and
  returned as JSON numbers.
- **Archive, not delete.** There is no `DELETE`. An archived type keeps its values; it is hidden
  from value entry and from Outcome totals, and returns to both when restored.

### `GET /api/v1/organizations/{orgId}/metric-types`
The organization's metric types.

- **Roles:** every member. A direct Site Admin is refused.
- **Request:** `?includeArchived=true|false`, default `false`. Unpaged: an organization holds a
  handful.
- **Response:** `200` with an array of metric type items, ordered by `createdAt` then
  `metricTypeId`.
- **Errors:** `401`; `403` a Site Admin acting directly; `404` the organization does not exist or is
  outside caller scope.

### `POST /api/v1/organizations/{orgId}/metric-types`
Create a metric type.

- **Roles:** in-scope Org Admin. A direct Site Admin is refused.
- **Request:** body `{ "name": <string>, "unit": <string|null> }`; `unit` may be absent.
- **Response:** `201` with the created item, `isArchived` `false`.
- **Errors:** `401`; `403`; `404` the organization; `400` keyed `name` (`"Name is required."`,
  `"Name must be 80 characters or fewer."`) or `unit` (`"Unit must be 20 characters or fewer."`).
- **Rules:** names are trimmed; a blank `unit` is stored `null`. Audit: `MetricTypeCreated`.

### `PUT /api/v1/organizations/{orgId}/metric-types/{id}`
Rename a metric type or change its unit, archive it, or restore it.

- **Roles:** in-scope Org Admin. A direct Site Admin is refused.
- **Request:** body `{ "name": <string>, "unit": <string|null>, "isArchived": <bool> }`, all
  required (full replacement, per Update Conventions).
- **Response:** `200` with the updated item.
- **Errors:** as for create, plus `404` the metric type does not exist or belongs to another
  organization.
- **Rules:** changing the unit does not convert stored values. Saving with nothing changed is a
  no-op with no audit event. Audit: `MetricTypeUpdated`, or `MetricTypeArchived` /
  `MetricTypeRestored` when `isArchived` changes.

### `GET /api/v1/ideas/{ideaId}/metrics`
An item's values.

- **Roles:** anyone who may read the item. A direct Site Admin is refused.
- **Response:** `200` with an array `[{ metricTypeId, name, unit, isArchived, projected, realized }]`,
  one entry per stored value, in the types' order. A value on an archived type is included and
  flagged, so the drawer can show it read-only.
- **Errors:** `401`; `403`; `404` the idea does not exist or is outside caller scope.
- **Rules:** the idea detail read (`contracts/ideas.md`) returns the same array as `metrics`. A
  card with a parent returns `[]`.

### `PUT /api/v1/ideas/{ideaId}/metrics`
Replace an item's values.

- **Roles:** anyone who may edit the item (author or Org Admin; never Read Only). A direct Site
  Admin is refused.
- **Request:** body `{ "metrics": [{ "metricTypeId": <guid>, "projected": <number|null>,
  "realized": <number|null> }] }`.
- **Response:** `200` with the item's values, as the read returns them.
- **Errors:** `401`; `403`; `404` the idea; `400` keyed `metrics`: a type that does not exist, is
  archived, or belongs to another organization (`"Metric type not found."`), a repeated
  `metricTypeId`, or a number outside the rules above (`"Projected must be between -999999999999999.99 and 999999999999999.99."`, likewise `Realized`, or `"Projected must have at most 2 decimal places."`); `422` `taskCannotCarryMetrics`: the item has
  a parent. A `404` idea takes precedence over a `400`.
- **Rules:**
  - **Full replacement over active types.** Every active type not in the body is cleared. Values on
    archived types are not touched and cannot be sent.
  - An entry with both numbers `null` clears that type.
  - **Only top-level items carry values:** a card with a parent is refused, so a rollup never
    counts a parent and its tasks twice.
  - **Realized has no gate.** It may be set in any lane; the UI emphasises it once the item is in a
    final lane.
  - A type is named by `400`, not `404`, because it is a body field, as for `outcomeId` in
    `contracts/outcomes.md`.
  - Audit: `IdeaMetricsChanged` (before and after). No notification. No change is a no-op with no
    audit event.

### Outcome totals
Every route in `contracts/outcomes.md` that returns an Outcome adds, beside the other rollup fields:

- `metricTotals` — an array `[{ metricTypeId, name, unit, projected, realized }]` over the
  **active** types that have at least one value on an item grouped under the Outcome, in the
  types' order, over **non-deleted items with no parent** (values left on an item that later has
  a parent are kept but not counted). Each sum skips `null`s; a sum with no non-null number is `null`. An Outcome with
  no values returns `[]` (so a newly created Outcome returns `[]`).
- Derived on read, never stored, like the rest of the rollup.
