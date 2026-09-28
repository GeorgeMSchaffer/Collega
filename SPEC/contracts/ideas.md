# Contracts: ideas

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Idea Contracts

### `GET /api/v1/boards/{boardId}/ideas`
Purpose: List ideas on a board with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional — defined 2026-09-27: the same matching as the organization list's `search` below (case-insensitive substring over title, author and assignee names, status name, priority, tag names, Problem and Text/Url User-Defined Field values, plus the ISO-date rule for Created Date), **minus board name**, since every item is on this board
- `statusId` optional
- `tag` optional
- `priority` optional `Low`, `Medium`, `High`, or `Critical`
- `dueBefore` optional date string (`YYYY-MM-DD`)
- `sortBy` optional `createdAt`, `updatedAt`, `upvoteCount`, `priority`, or `dueDate`; **added 2026-09-27**: `title`, `status` (lane order), `assignedTo`, `tags`
- `statusId`, `priority` and `tag` are repeatable from 2026-09-27 (any-of within a parameter)
- `sortDirection` optional `asc` or `desc`

**Phase filtering (added 2026-09-11, Issues and Delivery Slice 1).** This list is the ideation
board, so it returns only `Discovery`-phase items — an idea that has been promoted to an Issue
drops off it, with no data loss (the row and its ideation `statusId` are retained, and it reappears
here if the Issue is returned to Discovery). There is no query parameter for this; the filter is
unconditional. Delivery-phase items are read through `GET /api/v1/organizations/{orgId}/delivery`,
or through the global `/ideas` list with `phase=Issues`. For an organization that has promoted
nothing every idea is `Discovery`, so this endpoint's response is unchanged.

Success response `200` paged item shape:
- `ideaId`
- `boardId`
- `title`
- `priority` string
- `ideaTypeId` GUID string
- `ideaTypeName` string
- `businessImpactId` GUID string
- `businessImpactName` string
- `businessImpactColor` string
- `dueDate` date string (`YYYY-MM-DD`) or `null`
- `assignees` array with at most five items, ordered by `firstName`, then `lastName`; each item contains `userId`, `firstName`, `lastName`, `displayName`, and `isActive`; clients derive persona initials from the name fields
- `tagNames` string array, ordered alphabetically
- `statusId`
- `statusName`
- `upvoteCount`
- `hasUpvoted` boolean for the current caller
- `commentCount` integer
- `authorUserId`
- `createdAtUtc`

Added 2026-09-28 (comp R, `SPEC/decisions.md` 2026-09-28):
- `tags` array — the same tags as `tagNames`, in the same order, each `{ tagId, name, color }`, so a
  card can colour its chips without a second request. `tagNames` stays, unchanged, for every client
  written before it.
- `effort` string or `null`: `Low`, `Medium`, `High` — the idea's effort, for the effort bar on idea
  cards and rows, which shows whenever it is set (answered 2026-09-28). The delivery card already
  carried `effort`; it is the same field.

Because `GET /api/v1/organizations/{organizationId}/ideas` and the delivery card
(`GET /api/v1/organizations/{organizationId}/delivery`) reuse this item shape, both carry `tags`,
and the organization list carries `effort`.

### `GET /api/v1/organizations/{organizationId}/ideas`
Purpose: Cross-board, organization-scoped idea list for the global `/ideas` page (`SPEC/20-feature-client-ui-revisions.md` "Ideas Page"). Scoped to the caller's organization.

Query parameters:
- `page`
- `pageSize`
- `search` optional — all-column search across every column the `/ideas` list displays: the idea **Title**, **Created By** (author first/last/full name), **Assigned To** (any assignee's first/last/full name), and **Status** (status name); it also scans the values of Text/Url User-Defined Fields. When the term is a full ISO date (`YYYY-MM-DD`) it additionally matches the **Created Date** column (ideas created on that UTC calendar day). Matching is case-insensitive substring (`LIKE '%term%'`) except the date term, which matches the whole calendar day. **Added 2026-09-27** (the list pattern's text filter): it also matches the **board name**, the **priority**, **tag names**, and the idea's **Problem**, with the same substring semantics.
- `scope` optional `all` (default), `created` (authored by the caller), or `assigned` (assigned to the caller) — the caller's me-chips
- `tag` optional — filter to ideas carrying a tag whose normalized name equals the given value (same normalization/semantics as the board list's `tag`)
- `user` optional GUID — user-association search box: filter to ideas the given user **authored or is assigned to** (`SPEC/Bug Triage.md`). `Guid.Empty` is treated as absent. Composes (AND) with `scope`/`tag`/`search`/`fieldFilters` when combined.
- `sortBy` optional `createdAt` (default), `title`, `createdBy` (author name), `assignedTo` (alphabetically-first assignee's name), or `status` (status name); **added 2026-09-27** for the list pattern: `board` (board name), `priority` (Low→Critical order), `upvoteCount`, and `tags` (alphabetically-first tag)
- `boardId`, `statusId`, `priority` optional and repeatable (added 2026-09-27); `tag` becomes repeatable with any-of semantics
- `sortDirection` optional `asc` or `desc` (the page requests `desc` for newest-first). All sorts apply a stable `ideaId` tiebreaker so ordering is deterministic across pages.
- `fieldFilters[<fieldDefinitionId>]=<value>` optional, repeatable — filter by User-Defined Field value (T059). Semantics per field type: `Text`/`Url` contains; `Number` range `<min>:<max>` (either side omittable); `Date` range `<from>:<to>` (ISO-8601, either side omittable); `Boolean` `true`/`false`; `Dropdown` exact option id; `MultiSelect` any-of (matches when the stored option ids include the value). Unknown/invalid `fieldDefinitionId` keys and unparseable values are silently ignored.
- `phase` optional (added 2026-09-11, Issues and Delivery Slice 1) — `All` (**default**), `Ideas` (`Discovery`-phase only), or `Issues` (`Delivery`-phase only). Unrecognised values are treated as `All`. Unlike the board list this defaults to spanning **both** phases: this is the list somebody uses to find an item they cannot see on a board, and hiding promoted ones would lose them. Omitting it therefore leaves the response exactly as it was before the parameter existed.

Success response `200`: same paged item shape as `GET /api/v1/boards/{boardId}/ideas`.

### `GET /api/v1/boards/{boardId}/ideas/export`
Purpose: Export a board's active ideas as CSV (T059/T060).

Success response `200`:
- `Content-Type: text/csv` (UTF-8 with BOM), attachment `ideas.csv`
- Columns: `Title`, `Description`, `Priority`, `Idea Type`, `Business Impact`, `Status`, `Due Date`, `Tags`, then one column per active User-Defined Field (header = field name). Dropdown/MultiSelect values render as option labels.
- **Added 2026-09-27:** `Problem`, `Proposed Solutions` and `Impact Rationale` (`20-feature-ideas-and-engagement.md` rule 2a). Proposed Solutions writes the ordered list joined with a newline inside the one quoted cell (1 to 5 items). `Description` may be empty, since it is now optional.
- **`Discovery`-phase only** (added 2026-09-11), matching the board list above: the export is "this board's ideas", and a file that disagreed with the screen it was exported from would be the bug. Unchanged for any organization that has promoted nothing.

Limits and escaping (added 2026-08-11, Sprint 4):
- **Bounded at 10,000 ideas.** A board above the cap is refused with `400` rather than truncated — a silently short extract is worse than a clear failure for a file people use as a reporting export. The whole dataset is materialised in memory, and the endpoint is reachable by any member including Read Only, so the bound is what keeps it from being a cheap way to pressure the host.
- **Formula-injection guarded.** Any cell whose first non-apostrophe character is `=`, `+`, `-`, `@`, tab, or CR is written with a leading guard apostrophe (CWE-1236). The import strips exactly that guard, so an export → edit → re-import round trip returns the original values unchanged.

Error responses:
- `400` the board holds more ideas than the export supports

### `POST /api/v1/boards/{boardId}/ideas/import`
Purpose: Create-only CSV import of ideas onto a board (T059/T060). Multipart form field `csvFile`.

Behavior:
- Each data row creates a new idea. Required columns: `Title`, `Priority`, `Idea Type`, `Business Impact`; **`Description` is optional since 2026-09-27** (an optional summary). `Status` is optional (must name a board swimlane; defaults to the left-most swimlane); `Due Date`, `Tags`, and per-UDF-field columns are optional.
- `Idea Type` and `Business Impact` are matched by name (case-insensitive) against active options; a missing or unknown value rejects that row. Dropdown/MultiSelect UDF columns are matched by option label; Boolean accepts `Yes`/`No` or `true`/`false`.
- Invalid rows are rejected individually with a per-row message; valid rows still import.
- **Bounded (added 2026-08-11, Sprint 4):** the request body is capped at **5 MB** and the parsed file at **5,000 data rows**. Both are checked before any per-row work, since the upload is buffered whole and re-materialised as records before the first row is processed. A file over either bound is rejected in full — no partial import. The body limit is enforced at the request pipeline and answers `413`; the row ceiling is the handler's own and answers the field-keyed `400`.
- **Structured fields (added 2026-09-27).** `Problem` (max 2000), `Proposed Solutions` (1 to 5 items separated by newlines within the cell, each max 500) and `Impact Rationale` (max 1000) are optional columns. A row that lacks one, or leaves it blank, gets the backfill of `20-feature-ideas-and-engagement.md` rule 2a: Problem takes the row's `Description`, or *Not captured before 2026-09-27.* when that is blank too; Proposed Solutions takes the single item *Not captured before 2026-09-27.*; Impact Rationale takes the same text. A value over its limit, or more than five solutions, rejects the row.
- A leading guard apostrophe written by the export is stripped on import (see the export contract above). With the three structured columns in the export, re-importing an exported file is lossless.

Success response `200`:
- `createdCount` integer
- `rejectedCount` integer
- `rows` array of `{ rowNumber, title, outcome (`Created`/`Rejected`), error }`

Error responses:
- `400` the file is missing/empty, its header lacks the required columns, or it exceeds 5,000 rows
- `413` the request body exceeds 5 MB; the pipeline refuses it before it reaches the handler

### `POST /api/v1/boards/{boardId}/ideas`
Purpose: Create a new idea on a board.

Request body:
- `title` required string, max 150 characters
- `problem` required string, max 2000 characters (added 2026-09-27, `20-feature-ideas-and-engagement.md` rule 2a)
- `proposedSolutions` required array of 1 to 5 strings, each max 500 characters, order preserved (added 2026-09-27)
- `impactRationale` required string, max 1000 characters (added 2026-09-27)
- `description` optional string, max 4000 characters — **changed 2026-09-27 from required** to an optional summary (kept, Q2)
- `priority` required string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` required GUID string referencing an active Idea Type in the board's organization
- `businessImpactId` required GUID string referencing an active Business Impact in the board's organization
- `dueDate` optional date string (`YYYY-MM-DD`)
- `assigneeUserIds` optional array of zero to five distinct GUID strings; every user must be active and belong to the board's organization
- `statusId` optional GUID string, defaults to the left-most swimlane when omitted
- `tagNames` optional string array
- `mentionEmails` optional string array

Success response `201`:
- `ideaId`
- `boardId`
- `statusId`
- `title`
- `priority`
- `ideaTypeId`
- `businessImpactId`
- `dueDate`

### `POST /api/v1/boards/{boardId}/ideas/ai-draft`
> **Withdrawn 2026-09-27** (`20-feature-ai-idea-assist-v2.md` "Contract changes"): never built, and extraction is covered by the v2 turn endpoint. Kept for history.

Purpose: Turn a plain-English description into a pre-filled, unsaved idea draft for review. This endpoint never creates an idea; the client submits the reviewed result to `POST /api/v1/boards/{boardId}/ideas` as normal.

Authorized for the same roles as manual idea creation: Site Admin, Org Admin, and `User`. `Read Only` is rejected with `403`.

Request body:
- `rawInput` required string, min 20 characters, max 4000 characters, trimmed before validation

Behavior rules:
- authenticates with the board organization's own AI API key when configured, otherwise the deployment default key; on organization-key failure the call is retried once against the deployment default key
- the extraction call is constrained to the board organization's active Idea Type and Business Impact options and never receives the organization's user or tag lists
- `description` is produced by backend cleaning of `rawInput`, not by the model
- person, tag, and date mentions returned by the model as raw text are resolved in backend code against active organization users, existing tags, and a date parser
- unambiguous resolutions are returned pre-filled; ambiguous or unresolved mentions and no-signal required fields are returned in `clarifications`
- at most one clarification round is supported; the client resolves the returned questions locally and does not call this endpoint again for the same input

Success response `200`:
- `title` string, max 150 characters
- `description` string, max 4000 characters
- `priority` nullable string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` nullable GUID string
- `businessImpactId` nullable GUID string
- `dueDate` nullable date string (`YYYY-MM-DD`)
- `assigneeUserIds` array of zero to five distinct GUID strings, unambiguous resolutions only
- `tagNames` string array, unambiguous resolutions only
- `inferredFields` string array naming every field populated by inference rather than by unambiguous resolution; the client renders these as "inferred, unconfirmed" until the user interacts with them
- `clarifications` array, empty when nothing needs clarifying

`clarifications` item shape:
- `field` required string: `priority`, `ideaType`, `businessImpact`, `assignee`, `tag`, or `dueDate`
- `kind` required string: `choice` when a required field had no usable signal, or `disambiguation` when a mention matched more than one candidate
- `prompt` required string, the question presented to the user
- `sourceMention` nullable string, the raw input text that could not be resolved, null for `choice`
- `options` required array of `{ value, label }`, sourced from the organization's current active options for `choice` and from the matching candidates for `disambiguation`

Error responses:
- `400` request body is malformed or violates field constraints, including `rawInput` below the minimum length
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create ideas on this board
- `404` board does not exist or is outside caller scope
- `409` AI-assisted creation is not configured: neither an organization key nor a deployment default key is available
- `503` the provider failed after both the organization key and the deployment default key were attempted

`409` and `503` are feature-specific extensions to the standard error responses. The client treats both as recoverable by falling back to the blank manual idea form.

### `POST /api/v1/boards/{boardId}/ideas/ai-polish`
> **Withdrawn 2026-09-27**: never built; polishing belongs to the future refinement spec. Kept for history.

Purpose: Rewrite a draft description on explicit user request. This is the opt-in "Polish with AI" action and is never invoked automatically.

Authorized for the same roles as `ai-draft`.

Request body:
- `description` required string, min 20 characters, max 4000 characters, trimmed before validation

Behavior rules:
- uses the same key precedence and fallback behavior as `ai-draft`
- returns rewritten text only; the caller decides whether to accept it, and no idea is created or modified

Success response `200`:
- `description` string, max 4000 characters

Error responses:
- same set as `POST /api/v1/boards/{boardId}/ideas/ai-draft`

### `GET /api/v1/ideas/{ideaId}`
Purpose: Return full idea detail.

Success response `200`:
- `ideaId`
- `boardId`
- `title`
- `problem` string (added 2026-09-27)
- `proposedSolutions` string array (added 2026-09-27)
- `impactRationale` string (added 2026-09-27)
- `description` string or `null`
- `priority`
- `ideaTypeId`
- `ideaTypeName`
- `ideaTypeColorHex` string or `null` — the Idea Type's chip colour
- `ideaTypeIcon` string or `null` — the Idea Type's icon name
- `businessImpactId`
- `businessImpactName`
- `businessImpactColor`
- `dueDate`
- `assignees` array using the board-list assignee item shape
- `statusId`
- `statusName`
- `tagNames`
- `tags` array of `{ tagId, name, color }`, in `tagNames` order (added 2026-09-28)
- `mentions`
- `comments` array using the comment item shape from `GET /api/v1/ideas/{ideaId}/comments`, every comment on the idea in chronological order and unpaged
- `fieldValues` array of resolved User-Defined Field values (`fieldDefinitionId`, `fieldName`, `fieldType`, `value`), per `SPEC/20-feature-user-defined-fields.md`
- `formFields` array — the idea's own effective fields, for editing it: resolved from its Idea Type
  even when that type is archived, in form order. Each item is the `effectiveFields` item shape
  above plus `value`, the stored value in the form the write accepts (`true`/`false` for
  `Boolean`, option ids — comma-separated for `MultiSelect` — for choice fields, `YYYY-MM-DD` for
  `Date`), or `null` when unset. An option the idea stores that the field no longer offers is
  still listed in that item's `options`, with `isArchived: true`, so an unchanged save keeps it.
  Options are hard-deleted, so such an option's `label` falls back to its `optionId`.
  `fieldValues` stays as the display projection (labels, `Yes`/`No`). Added 2026-09-27.
- `upvoteCount`
- `hasUpvoted` boolean for the current caller
- `commentCount` integer
- `author` object using the same assignee item shape, or `null` — who raised the idea
- `createdAtUtc` timestamp

`author` and `createdAtUtc` were added 2026-09-10: the detail header renders "by {author} on
{date}" and had no source for either. `author` is the full persona rather than the bare
`authorUserId` the list item carries, so the name renders without a second request per idea
opened. It is nullable only because `ideas.author_user_id` carries no foreign key; no code path
deletes a user, so a `null` there is data damage rather than an ordinary case to design a label
for.

`ideaTypeColorHex`, `ideaTypeIcon` and `fieldValues` were **missing from this document, not from
the endpoint** — all three have been returned since long before the 2026-09-10 additions above, and
the recorded corpus carries them. Written down 2026-09-10 because a contract that omits fields the
endpoint really answers misleads every reader of it; nothing about the response changed.

There is deliberately **no** `reference` field. The comps show `IDEA-101`, but no reference column
exists and the Prisma schema is frozen at S0.2 — a real reference needs a per-organization
sequence and therefore a schema amendment slice.

`PUT /api/v1/ideas/{ideaId}` answers this same detail shape, and carries both fields with it.

### `PUT /api/v1/ideas/{ideaId}`
Purpose: Update idea content.

Request body:
- `title` required string, max 150 characters
- `problem` required string, max 2000 characters (added 2026-09-27, `20-feature-ideas-and-engagement.md` rule 2a)
- `proposedSolutions` required array of 1 to 5 strings, each max 500 characters, order preserved (added 2026-09-27)
- `impactRationale` required string, max 1000 characters (added 2026-09-27)
- `description` optional string, max 4000 characters — **changed 2026-09-27 from required** to an optional summary (kept, Q2)
- `priority` required string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` required GUID string referencing an active Idea Type in the idea's organization
- `businessImpactId` required GUID string referencing an active Business Impact in the idea's organization
- `dueDate` optional date string (`YYYY-MM-DD`)
- `assigneeUserIds` optional array of zero to five distinct GUID strings; every newly selected user must be active and belong to the idea's organization
- `tagNames` optional array of no more than 10 distinct normalized tag names
- `mentionEmails` optional string array
- `effort` optional string: `Low`, `Medium`, or `High` — the optional Discovery-phase effort estimate (added 2026-09-11, Issues and Delivery Slice 1)

**`effort` is three-state, and that is deliberate** — it is the only field on this payload that is.
The key being **absent** means "not provided": the stored estimate is left untouched. An explicit
**`null`** clears it. A **value** sets it. A plain two-state optional (absent reading as `null`, the
way `dueDate` does) would make every client that predates this field silently clear the estimate on
an unrelated edit, and on a promoted Issue that estimate is half of what the promotion gate
recorded. An unrecognised value is a field-keyed `400`.

`effort` may only be set while the idea is in the **`Discovery`** phase. Supplying it for a
`Delivery`-phase item returns `400` keyed on `effort`: effort is chosen at the promotion gate,
alongside `promotedByUserId` and `upvoteCountAtPromotion`, and re-estimating a live Issue is not
modelled in this slice. Omitting the key on an Issue is always valid.

UI behavior contract:
- board cards remain compact and show `title`, `priority`, Business Impact chip, the first three alphabetical `tagNames` plus tag overflow count, the first three ordered `assignees` plus assignee overflow count, viewer-local age derived from `createdAtUtc`, current-user upvote state/count, and comment count.
- selecting the card title opens the Idea Detail drawer (right slide-in; URL gains `?idea={ideaId}`, addressable as `/ideas/{ideaId}`) for full idea editing.
- Idea Detail supports all editable idea fields and collaboration fields.
- selecting the card comment action navigates to Idea Detail and focuses the comment composer.
- description updates are accepted only from the idea author, an in-scope Org Admin, or Site Admin; unauthorized description changes return `403 Forbidden`.
- assignee updates replace the complete collection atomically and are accepted only from the idea author, an in-scope Org Admin, or Site Admin; unauthorized assignment changes return `403 Forbidden`.
- duplicate assignee IDs, more than five assignee IDs, inactive newly selected users, cross-organization users, or more than 10 distinct tags return `400 Bad Request`.

### `POST /api/v1/ideas/{ideaId}/status`
Purpose: Move an idea to another board status.

Request body:
- `statusId` required GUID string

Success response:
- `204 No Content`

### `DELETE /api/v1/ideas/{ideaId}`
Purpose: Soft-delete an idea while preserving its row and audit history.

Authorization:
- Site Admin within the target resource context
- Org Admin within their own organization

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is not an authorized in-scope admin
- `404` idea does not exist, is already deleted, or is outside caller scope

Query behavior:
- normal board, list, and detail endpoints exclude soft-deleted ideas
- no restore endpoint is exposed in this release

