# Contracts: ai-assist

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## AI Idea Assist Contracts

Behavior spec: `SPEC/20-feature-ai-idea-assist.md`. Sprint 7 (`SPEC/sprints/archive/sprint-07-ai-idea-assist.md`). **Built 2026-08-16**, except the per-org `ai-key` endpoints in [`contracts/organizations.md`](organizations.md), which stay deliberately unimplemented (rule 30).

Contract-wide rules for this section:
- the caller's organization is resolved from the access token, never from the request body
- the client never sends a prompt, system instructions, model name, retrieved context, or the organization's scope statement — the server assembles all of it
- these endpoints **never create, update, or delete an idea**; they return draft suggestions that seed the create form, which is submitted separately through `POST /api/v1/boards/{boardId}/ideas` and validated there as normal
- suggested option ids are always active options in the caller's organization; the server rejects a model response containing any id outside the retrieved set rather than passing it to the client

### `POST /api/v1/boards/{boardId}/idea-assist/turns`
Advance the idea-drafting conversation by one turn and return the updated draft.

> **v2 (specified 2026-09-27, contract written 2026-10-20, slice 306; not built):** the turn contract changes as set out in ["v2 turn contract"](#v2-turn-contract-slice-306-not-built) below. `20-feature-ai-idea-assist-v2.md` "Contract changes" is authoritative; the shape in this section is v1, live today, and is replaced when slice 307 ships.

- **Roles:** any member of the board's organization who may create ideas (Read Only is refused).
- **Request:**
  - `transcript` required array, ordered oldest-first, **max 20 entries** — user and assistant messages combined, per `20-feature-ai-idea-assist.md` rule 5. **The cap counts entries, not user turns** (corrected 2026-09-07 to rule 5a's recorded resolution; it previously read "max 40 entries of which at most 20 may have `role` of `user`", which contradicted the 20-entry cap elsewhere in this section and the shipped implementation). Each entry:
    - `role` required string, one of `user`, `assistant`
    - `text` required string, max 4000 characters, trimmed before validation
  - `draft` optional object — the current draft, so the model can revise rather than restate. Same shape as `draft` in the response; unknown or inactive ids are discarded server-side rather than rejected
- **Response:** `200`
  - `inScope` boolean
  - `conversationClosed` boolean
  - `nextQuestion` string — the assistant's reply; the only free-text field the model produces
  - `draft` object:
    - `title` string or null, max 150 characters
    - `description` string or null, max 4000 characters
    - `ideaTypeId` GUID string or null — an active idea type in this organization
    - `businessImpactId` GUID string or null — an active business impact in this organization
    - `priority` string or null, one of the `Priority` enum values
  - `turnsRemaining` integer — how many further **user** turns fit under the 20-entry cap, counted from the transcript as it will stand after this turn is applied
- **Errors:**
  - `400` request body is malformed, violates field constraints, exceeds the 20-entry transcript cap, or does not end with a `user` entry
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to create ideas on this board
  - `404` board does not exist or is outside caller scope
  - `429` rate limit exceeded for this user or organization
  - `503` AI assist is not configured, the provider is unavailable, **or the deployment's daily token budget is exhausted** (`20-feature-ai-idea-assist.md` rule 28a) — clients degrade to the scripted brainstorm chat rather than surfacing an error. The three causes are deliberately indistinguishable to the client: all three mean "the assistant is unavailable, keep working without it."
- **Rules:**
  - the final transcript entry must have `role` of `user`
  - the server assembles retrieval context (active idea types with their resolved field sets, business impacts, board statuses, tags, members) scoped to the caller's organization
  - the response schema's `ideaTypeId` and `businessImpactId` are constrained to the retrieved active option ids
  - a turn judged out of scope returns `inScope` `false`, `draft` unchanged, and `nextQuestion` carrying the server's fixed redirect string; the client discards the offending user turn rather than appending it
  - three consecutive out-of-scope turns additionally return `conversationClosed` as `true`
  - rate limited per user and per organization; each call writes an audit event recording the actor, organization, board, turn count, token usage, and out-of-scope outcome, and never the prompt or transcript content

#### v2 turn contract (slice 306, not built)

*Written 2026-10-20 (slice 306; owner to review). Anything marked **owner to review** is a reading of the v2 spec that it does not state; the marked items are collected as questions in the slice report.* Same route, roles, `404`/`401`/`403`/`429`/`503` meanings, transcript rules (20 entries, last entry `user`), audit event and rate limits as above. What changes:

- **Request** adds:
  - `draft` optional object, the person's current form values, so the model revises rather than restates. Every key is optional; an absent key and `null` both mean "nothing there yet". A draft is partial, so the create minimums (at least one proposed solution) do **not** apply to it. Limits are those of `POST /api/v1/boards/{boardId}/ideas` in [`ideas.md`](ideas.md):
    - `title` string, max 150 characters
    - `problem` string, max 2000 characters
    - `proposedSolutions` array of strings, at most 5 items, each max 500 characters
    - `impactRationale` string, max 1000 characters
    - `businessImpactId` GUID string, `ideaTypeId` GUID string. Unknown or inactive ids are discarded, not rejected, as in v1
    - `priority` string, one of `Low`, `Medium`, `High`, `Critical`. An unrecognised value is dropped, as in v1
    - `tagNames` array of strings, at most 10 (`ideas.md`: no more than 10 distinct tag names). Names not in the organization's tag vocabulary are discarded
    - `fieldValues` array of `{ fieldDefinitionId, value }`. `value` is the string serialization of [`20-feature-user-defined-fields.md`](../20-feature-user-defined-fields.md) `IdeaFieldValue`: `Text`/`Url` raw string, `Number` invariant decimal string, `Date` `yyyy-MM-dd`, `Boolean` `"true"`/`"false"`, `Dropdown` one option id, `MultiSelect` comma-separated option ids. Entries for a definition that is not visible for the draft's `ideaTypeId` are discarded
    - `description` string, max 4000 characters (the optional summary)
  - `lockedFields` optional string array: the fields the person owns. Each entry is a draft key above (`title`, `problem`, `proposedSolutions`, `impactRationale`, `businessImpactId`, `ideaTypeId`, `priority`, `tagNames`, `description`) or `fieldValues.<fieldDefinitionId>` for a custom field. The server drops any model output for a locked field (enforced server-side, not only in the UI). An entry that names no known field is ignored, not rejected. **Owner to review:** ignore vs `400`.
  - `step` optional string: the `nextStep` of the previous assistant turn, in the same vocabulary (see `nextStep`). Absent on the first turn. **Owner to review:** a value outside the vocabulary is ignored here; the alternative is `400`.
- **Response** `200` replaces `draft` with:
  - `changes` object, always present and `{}` when nothing was set: only the keys this turn set, each in the shape and under the limits of the request `draft`. `proposedSolutions` is the **full replacement list** (1 to 5 items), not an addition; `fieldValues` carries only the entries set this turn. It never contains a locked field, an id outside the organization's active options, a tag outside its vocabulary, or a custom field not visible for the (possibly just-changed) Idea Type. **Owner to review:** replacement vs append for `proposedSolutions`.
  - `suggestions` object, optional (absent when the turn offers none): `solutions` array of at most 3 strings, each max 500 characters; `problemRewrite` string, max 2000 characters; `rationales` array of at most 3 strings, each max 1000 characters. The lengths follow the field they would fill; the v2 spec states only the counts. **Owner to review.** Suggestions are never applied by the server: the client applies one only when the person chooses it.
  - `nextStep` string: the field the reply asks about, or `done`. One of `title`, `problem`, `proposedSolutions`, `impactRationale`, `businessImpactId`, `ideaTypeId`, `fieldValues.<fieldDefinitionId>`, `done`. Never a locked field. Interview order is Problem, Proposed solutions, Impact rationale, Business impact, Idea type, required custom fields of that type (`fieldValues.<fieldDefinitionId>`), then Title if still empty; `priority`, `tagNames` and `description` are filled when the person gives cues and are never asked about. **Owner to review:** whether `priority`, `tagNames` or `description` may ever be a `nextStep`.
  - `nextQuestion` string, `inScope` boolean, `conversationClosed` boolean, `turnsRemaining` integer: as v1. A turn judged out of scope returns `changes` `{}`, no `suggestions`, `nextQuestion` the fixed redirect, and `nextStep` equal to the request `step`, or `problem` when the request has none. **Owner to review:** the out-of-scope `nextStep`.
- **Errors** (additions; the `400` envelope is the shared one, keyed by request field name, message templates from `30-Contracts.md`):
  - `400` `title` "Title must be 150 characters or fewer."; `problem` "Problem must be 2000 characters or fewer."; `impactRationale` "Impact Rationale must be 1000 characters or fewer."; `description` "Description must be 4000 characters or fewer."; `proposedSolutions` "Proposed Solutions must have 5 items or fewer." and "Each proposed solution must be 500 characters or fewer."; `tagNames` "Tag Names must have 10 items or fewer."; `lockedFields` or `step` when not a string array or string, "<Field> is invalid.". **Owner to review:** the exact keys and wording; they follow the v1 draft keys (`title`, `description`) and the idea create wording.
- **Rules:**
  - the JSON Schema sent to the model is built per request from the retrieval result (v1 rules 15-18, `20-feature-ai-idea-assist.md`): `changes` offers only the unlocked fields; `ideaTypeId` and `businessImpactId` are closed enums of the organization's active option ids; `tagNames` items are an enum of the organization's tag names; `priority` is the closed `Priority` enum; the Idea Type's visible custom fields are offered as typed `fieldValues` entries, a Dropdown or MultiSelect value constrained to that field's option ids. The custom fields are those visible for the **draft's** `ideaTypeId`; a type the model chooses in the same turn does not expose its custom fields until the next turn. **Owner to review.** `additionalProperties` is `false` and `nextQuestion` (with the suggestion strings) is the only free text
  - the server re-validates every value against the retrieved set after the call (v1 rule: reject a response containing an id outside it) and then removes locked fields
  - a locked `ideaTypeId` fixes which custom fields are offered; a locked custom field is omitted from the schema
  - the rules for the 20-entry cap, scope gate, three-strikes close, `429` and usage metering are unchanged
  - `POST /api/v1/boards/{boardId}/ideas/ai-draft` and `.../ai-polish` ([`ideas.md`](ideas.md)) are **withdrawn**: never built, and the turn endpoint covers extraction. No new endpoint replaces them

### `GET /api/v1/ai-assist/availability`
Tell the client whether to open the drafting chat or go straight to the create form (`20-feature-ai-idea-assist.md` rule 32a).

- **Roles:** **any authenticated user** — unlike the org-scoped settings endpoint below, which is admin-only. Idea creation is a `User`-role activity, so an admin-only check could not serve this purpose.
- **Request:** —
- **Response:** `200`
  - `available` boolean
- **Errors:** `401` caller is not authenticated
- **Rules:**
  - returns a bare boolean and **never** distinguishes unconfigured from provider-unavailable from budget-exhausted, matching the deliberate opacity of the turn endpoint's `503` (rule 31). It carries no key material, no org configuration, and no usage figures
  - reflects deployment key configuration and the current UTC day's budget at the moment of the call; it is a snapshot, not a subscription, so clients must still handle a `503` on a turn

### `GET /api/v1/ai-assist/prompt`
Read the active system-prompt template, the two redirect strings, and the version history (`20-feature-ai-idea-assist.md` rules 34–36).

- **Roles:** **Site Admin only.** Deployment configuration, not organization content — the same scope as the deployment API key (rule 29). Org Admin is refused.
- **Request:** —
- **Response:** `200`
  - `body` string — the active template, including its `{{ORGANIZATION_CATALOG}}` and `{{SCOPE_STATEMENT}}` placeholders
  - `outOfScopeRedirect` string · `conversationClosedRedirect` string
  - `version` integer or null · `isBuiltInDefault` boolean
  - `versions` array, newest first: `version`, `createdAtUtc`, `createdByUserId`, `createdByDisplayName`, `isActive`
- **Errors:** `401` unauthenticated · `403` caller is not a Site Admin
- **Rules:** when no version is active, returns the built-in default with `version` of `null` and `isBuiltInDefault` true. An empty history is the normal initial state, not an error.

### `PUT /api/v1/ai-assist/prompt`
Publish a new version.

- **Roles:** — (see Errors)
- **Request:**
  - `body` required string, max 20000 characters. **Must contain both `{{ORGANIZATION_CATALOG}}` and `{{SCOPE_STATEMENT}}`**
  - `outOfScopeRedirect` required string, max 500 characters
  - `conversationClosedRedirect` required string, max 500 characters
- **Response:** `200`, same shape as the `GET`.
- **Errors:**
  - `400` a placeholder is missing, or a field is empty or over length. The message names the missing placeholder
  - `401` unauthenticated · `403` caller is not a Site Admin
- **Rules:**
  - appends a version and makes it active; earlier versions are never modified
  - writes an audit event recording actor and version number, never the body (rule 27)

### `POST /api/v1/ai-assist/prompt/versions/{version}/restore`
Republish an earlier version.

- **Roles:** —
- **Request:** —
- **Response:** `200`, same shape as the `GET`.
- **Errors:** `401` · `403` · `404` no such version.
- **Rules:** publishes a **copy** of `{version}` as a new version rather than reactivating the old row, so history stays append-only and the restore is itself visible in it.

### `POST /api/v1/ai-assist/prompt/reset`
Return the deployment to the built-in default template. *Added 2026-09-29 from the code (slice 134): the route was served and recorded by the golden corpus (`aiassist.prompt.reset.*`) but never documented here.*

- **Roles:** Site Admin only, as for the `GET`.
- **Request:** —
- **Response:** `200`, same shape as the `GET` — with no version active, the built-in default with `version` of `null` and `isBuiltInDefault` true.
- **Errors:** `401` unauthenticated · `403` caller is not a Site Admin
- **Rules:**
  - deactivates every version rather than deleting any, so the history keeps the record of what ran and a later restore can bring any of them back
  - writes an `AiPromptResetToDefault` audit event

### `POST /api/v1/ai-assist/prompt/probe`
Run advisory safety probes against a draft template before publishing (rule 37).

- **Roles:** Site Admin only (see Rules).
- **Request:** `body` required string — the **draft**, which need not have been saved.
- **Response:** `200`
  - `probes` array: `id`, `prompt`, `refused` boolean, `expectedRefused` boolean
  - `refusedCount` integer · `totalCount` integer
- **Errors:**
  - `400` the draft is missing a required placeholder · `401` · `403` not a Site Admin
  - `429` rate limit exceeded · `503` AI assist is unavailable or the daily budget is exhausted
- **Rules:**
  - runs the injection, fence-closing and off-topic probes against a **synthetic catalog** — never a real organization's — and reports whether each was refused
  - **advisory only** — this endpoint never publishes anything and a failing probe never blocks a later `PUT`
  - subject to the global daily budget gate, but **not** per-organization rate limited and **not** recorded in the usage meter: both need an organization to attribute spend to and a Site Admin has none (`20-feature-ai-idea-assist.md` rule 37b). Bounded instead by construction — three fixed prompts, Site Admin only
  - a failed provider call returns `503` rather than reporting the probe as refused

### `GET /api/v1/organizations/{organizationId}/ai-assist/settings`
Read the organization's AI assist configuration for the settings UI.

- **Roles:** Site Admin on any organization, and Org Admin on their own organization only.
- **Request:** —
- **Response:** `200`
  - `aiAssistAvailable` boolean — a deployment key is configured and the feature is on
  - `scopeStatement` string or null
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to administer this organization
  - `404` organization does not exist or is outside caller scope
- **Rules:** reports whether the deployment has a key configured; never returns a key or any part of one.

### `PUT /api/v1/organizations/{organizationId}/ai-assist/settings`
Set or clear the organization's scope statement — the free-text narrowing of what the assistant will discuss.

- **Roles:** Site Admin on any organization, and Org Admin on their own organization only.
- **Request:**
  - `scopeStatement` required string or null, max 500 characters, trimmed before validation. Null or empty clears it, leaving the organization's active Idea Types as the only scope boundary
- **Response:** `200`
  - `scopeStatement` string or null
- **Errors:**
  - `400` request body is malformed or the statement exceeds 500 characters
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to administer this organization
  - `404` organization does not exist or is outside caller scope
- **Rules:**
  - generates an audit event recording the acting user and the new value
  - takes effect on the next turn; in-flight conversations are not retroactively re-scoped

### `GET /api/v1/ai-assist/usage`
Platform-wide AI consumption, one row per organization — the Site Admin's view of who is spending what.

- **Roles:** **Site Admin only.** All other roles receive `403`.
- **Request:** query parameters:
  - `fromUtc` optional date — defaults to the first day of the current UTC month
  - `toUtc` optional date — defaults to now
- **Response:** `200`
  - `fromUtc`, `toUtc`
  - `dailyTokenLimit` integer — the configured ceiling (rule 28a)
  - `tokensUsedToday` integer — consumption against that ceiling for the current UTC day, across all organizations
  - `organizations` array, ordered by total tokens descending. Each entry:
    - `organizationId` GUID string, `organizationName` string
    - `calls` integer
    - `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens` integers
    - `estimatedCost` decimal — in USD, from the stored rates
  - `totals` object — the same numeric fields summed across organizations
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is not a Site Admin
- **Rules:**
  - rows cover every organization with usage in the window, including archived ones (spend already incurred does not disappear when an org is archived)
  - cost is computed from the rates stored on each usage record, not from current configuration, so a pricing change never re-prices history

### `GET /api/v1/organizations/{organizationId}/ai-assist/usage`
One organization's AI consumption.

- **Roles:** Site Admin on any organization, and Org Admin **on their own organization only**. All other roles receive `403`.
- **Request:** query parameters `fromUtc`, `toUtc` — same defaults as above.
- **Response:** `200`, a single organization entry in the shape above, plus `fromUtc` / `toUtc`. `dailyTokenLimit` and `tokensUsedToday` are **omitted** — the ceiling is platform-wide and is not an organization's business.
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to administer this organization
  - `404` organization does not exist or is outside caller scope
- **Rules:** —
