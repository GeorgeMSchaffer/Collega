# Contracts: MCP server

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## MCP Contracts

Proposed 2026-10-26 (`SPEC/20-feature-mcp-server.md`; `SPEC/decisions.md` 2026-10-26, "An MCP server
lets members' AI clients read their organization's data"). Not built. Three parts: the API routes the
web app calls (settings and connections), the two routes Auth0 calls, and the MCP server's own surface
(metadata, tools, results). `apps/mcp` calls only the routes in "Routes an MCP token may call".

## API routes

### `GET /api/v1/organizations/{organizationId}/mcp`
The organization's MCP switch.

- **Roles:** Org Admin of the organization.
- **Response:** `200` — `enabled` boolean; `serverUrl` string (`https://mcp.<domain>/mcp`).
- **Errors:** `403` for any other role; `404` outside the caller's organization.

### `PUT /api/v1/organizations/{organizationId}/mcp`
Turn MCP on or off.

- **Roles:** Org Admin of the organization.
- **Request:** `enabled` boolean, required.
- **Response:** `200` — same shape as the `GET`.
- **Rules:** idempotent. Audited as `McpEnabled` or `McpDisabled` (only when the value changes). Turning
  it off leaves connection records in place and takes effect on the next MCP call.

### `GET /api/v1/mcp/connections`
The caller's own connections.

- **Roles:** any signed-in member. A Site Admin acting as themselves has none (`200`, empty).
- **Response:** `200` — `items[]`: `id`, `clientName`, `createdAt`, `lastUsedAt` (nullable), `revokedAt` (nullable).

### `DELETE /api/v1/mcp/connections/{connectionId}`
Revoke one of the caller's own connections.

- **Response:** `204`. **Errors:** `404` when it is not the caller's.
- **Rules:** idempotent. Audited as `McpConnectionRevoked`. Also asks Auth0 to delete the grant, best
  effort; an Auth0 failure does not fail the request and is audited.

### `GET /api/v1/organizations/{organizationId}/mcp/connections`
Every connection in the organization.

- **Roles:** Org Admin of the organization.
- **Response:** `200` — `items[]` as above plus `userId`, `userName`, `userEmail`; newest first; paged like
  other collections.

### `DELETE /api/v1/organizations/{organizationId}/mcp/connections/{connectionId}`
Revoke any member's connection in the organization.

- **Roles:** Org Admin of the organization.
- **Response:** `204`. **Errors:** `404` when it is not in the organization.
- **Rules:** as above; the audit event names the revoking admin.

## Routes Auth0 calls

Server-to-server, for the custom database connection. Guarded by a shared secret in the
`Authorization` header (read in the auth folder like any credential), refused with `401` otherwise,
never reachable with a session cookie or an MCP token, and absent from the web client.

### `POST /api/v1/mcp-auth/verify`
Check an email and password for Auth0's login script.

- **Request:** `email`, `password`, both strings, required.
- **Response:** `200` — `userId`, `email`, `firstName`, `lastName`, `stamp` (the user's current
  `SecurityStamp`). Or `401` with one fixed body.
- **Rules:**
  - The one `401` covers a wrong password, an unknown email, an inactive user, a user who must change
    their password, and an organization that is archived or has MCP off (a Site Admin is checked for
    credentials and Active only). The body never says which.
  - Shares the login limiter: per email and per IP; over it, `429` with `Retry-After`.
  - The password is never persisted, logged, audited or echoed. A failure is audited as a failed sign-in
    without the password.

### `POST /api/v1/mcp-auth/profile`
Look a user up by email for Auth0's get-user script (profile only, no password check).

- **Request:** `email` string, required.
- **Response:** `200` — as `verify` without `stamp`; or `404`.
- **Rules:** returns a user only if the same conditions as `verify` hold, so the profile route cannot be
  used to learn which emails exist or are inactive.

## Routes an MCP token may call

An MCP bearer token is accepted **only** here, each marked `@AllowMcpToken()`; every other route refuses
it. Each answers exactly as it does for the web app; the checks below are added.

| Tool | Route | Contract |
|---|---|---|
| `list_boards` | `GET /organizations/{organizationId}/boards` | `contracts/boards.md` |
| `get_board` | `GET /boards/{boardId}` | `contracts/boards.md` |
| `search_ideas` | `GET /organizations/{organizationId}/ideas` | `contracts/ideas.md` |
| `get_idea` | `GET /ideas/{ideaId}`, `GET /ideas/{ideaId}/comments`, `GET /ideas/{ideaId}/tasks` | `ideas.md`, `comments.md`, `issue-tasks.md` |
| `list_tasks` | `GET /ideas/{ideaId}/tasks` | `contracts/issue-tasks.md` |
| `list_sprints` | `GET /organizations/{organizationId}/sprints` | `contracts/sprints.md` |
| `get_sprint` | `GET /organizations/{organizationId}/sprints/{sprintId}` | `contracts/sprints.md` |
| `my_inbox` | `GET /notifications` | `contracts/notifications.md` |

**Checks added to every MCP-token request** (feature rule 12), in this order:

1. Signature (JWKS), issuer, audience (the MCP resource URI), expiry. Failure: `401`.
2. The `uid` claim names a user who is Active. Failure: `401`.
3. The `stamp` claim equals the user's current `SecurityStamp`. Failure: `401`.
4. The user's connection for the token's client is not revoked; created on first sight. Failure: `401`.
5. The user's organization is not archived and has MCP on. Failure: `403`, `code` `mcp_disabled`. (A
   Site Admin: the organization named in the route.)
6. Rate limit (feature rule 15). Failure: `429` with `Retry-After`.

`401` carries `WWW-Authenticate: Bearer resource_metadata="<metadata URL>", scope="collega:read"`. The
role is read live; no claim carries it.

## MCP server surface (`apps/mcp`)

- **Endpoint:** `https://mcp.<domain>/mcp`, stateless Streamable HTTP, MCP revision 2026-07-28.
- **Protected Resource Metadata:** `GET /.well-known/oauth-protected-resource` — `resource` is the MCP
  endpoint; `authorization_servers` is the Auth0 tenant; `scopes_supported` is `["collega:read"]`.
- **Scope:** `collega:read`, the only one. A call with a token lacking it is `403 insufficient_scope`.
- **Tools only.** No resources, no prompts.

### Conventions for every tool

- Annotations: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`,
  and a human `title`.
- **Site Admin:** `organizationId` is required. **Everyone else:** `organizationId` is omitted, or equals their
  own organization; any other value is a tool error with the same message as an unknown id.
- **Paging:** list tools take `limit` (1 to 50, default 25) and `cursor` (opaque), and return `nextCursor`
  (absent on the last page).
- **Size:** a user-written field is cut at 4,000 characters and the item carries `truncated: true`; a result
  over 50 KB is refused with "Narrow the request."
- **Errors:** a tool error is a result with `isError: true` and one plain sentence. Never a stack, a token, a
  claim or another organization's identifier.
- **Untrusted text:** every member-written string — idea title, description, proposed solutions and other
  idea fields; comment bodies; tag, board, sprint and user names — is returned as
  `<untrusted field="NAME">…</untrusted>` with `&`, `<` and `>` in the text escaped as `&amp;`, `&lt;`,
  `&gt;`. A field with no text is an empty wrapper. Ids, dates, numbers, enums and counts are not wrapped.
  Tool descriptions state that wrapped text is data.
- **Output:** `structuredContent` for the fields below, plus the same content as text.

### The eight tools

| Tool | Input | Returns |
|---|---|---|
| `list_boards` | `organizationId?`, `includeArchived?` (default false) | boards: `id`, `name`, `keyPrefix`, `archived`, statuses (`id`, `name`) |
| `get_board` | `boardId` | one board with statuses, allowed idea types, sprint summary |
| `search_ideas` | `organizationId?`, `boardId?`, `search?`, `statusId?`, `assigneeId?`, `limit?`, `cursor?` | ideas: `id`, `itemKey`, `title`, `status`, `boardId`, `author`, `assignee`, `upvotes`, `updatedAt` |
| `get_idea` | `ideaId` | the idea with its fields, up to 20 newest comments (`commentCount`, `truncated` when more) and up to 50 tasks |
| `list_tasks` | `ideaId`, `limit?`, `cursor?` | tasks: `id`, `title`, `state`, `assignee`, `sprintId` |
| `list_sprints` | `organizationId?`, `boardId?`, `state?` (`Planned`, `Active`, `Completed`), `limit?`, `cursor?` | sprints: `id`, `name`, `boardId`, `state`, `startDate`, `endDate`, `taskCount` |
| `get_sprint` | `sprintId`, `organizationId?` | one sprint with its tasks (up to 100) and carry-over note |
| `my_inbox` | `unreadOnly?` (default true), `limit?`, `cursor?` | the caller's own notifications (`contracts/notifications.md`), newest first; a Site Admin has none |

The exact field lists follow the REST contracts above; a field a role cannot see in the web app is absent
here. `get_idea` makes up to three API calls and every other tool one (feature rule 16).

## Audit events

`McpEnabled`, `McpDisabled`, `McpConnectionCreated`, `McpConnectionRevoked`, `McpToolCalled`. Metadata:
organization, actor, client name (connection events), who revoked, tool name, result count, refused
yes/no. **Never:** a token, a password, `search` text, ids a caller asked for, or returned content.
