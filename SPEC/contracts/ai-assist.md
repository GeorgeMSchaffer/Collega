# Contracts: ai-assist

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## AI Idea Assist Contracts

Behavior spec: `SPEC/20-feature-ai-idea-assist.md`. Sprint 7 (`SPEC/sprints/archive/sprint-07-ai-idea-assist.md`). **Built 2026-08-16**, except the per-org `ai-key` endpoints below, which stay deliberately unimplemented (rule 30).

Contract-wide rules for this section:
- the caller's organization is resolved from the access token, never from the request body
- the client never sends a prompt, system instructions, model name, retrieved context, or the organization's scope statement — the server assembles all of it
- these endpoints **never create, update, or delete an idea**; they return draft suggestions that seed the create form, which is submitted separately through `POST /api/v1/boards/{boardId}/ideas` and validated there as normal
- suggested option ids are always active options in the caller's organization; the server rejects a model response containing any id outside the retrieved set rather than passing it to the client

### `POST /api/v1/boards/{boardId}/idea-assist/turns`
Advance the idea-drafting conversation by one turn and return the updated draft.

> **Changes in v2 (specified 2026-09-27, not built):** `draft` carries the structured fields, the request adds `lockedFields` and `step`, and the response returns `changes`, `suggestions` and `nextStep` instead of `draft`. `20-feature-ai-idea-assist-v2.md` "Contract changes" is authoritative for them; the shape below is v1, live today.

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
