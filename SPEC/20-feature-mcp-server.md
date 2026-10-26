# Feature: MCP Server (read-only), with Auth0 as the Authorization Server

> **At a glance** (added 2026-10-26; the text below wins where they differ)
> - **Scope:** a remote MCP server so a member's own AI client (Claude, ChatGPT, Cursor and the like) can
>   read their organization's boards, ideas, comments, tasks, sprints and inbox. **Read-only in v1.**
>   Off by default per organization; an Org Admin turns it on (rules 1–5).
> - **Key rules:** the member signs in with their Collega email and password through Auth0, which verifies
>   them against Collega and never stores a password (6–8); tokens last about 15 minutes and Collega
>   rechecks the user, security stamp, organization switch and connection on **every call** (12–14); an MCP
>   token works only on the nine read routes behind the tools, never on the rest of the API (4, 11); 60
>   calls a minute per user and 600 per organization (15); connections and every tool call are audited with
>   no query text or content (17); user-written text is escaped and labelled in every result (18).
> - **Contracts:** `contracts/mcp.md`
> - **Decisions:** 2026-10-26 "An MCP server lets members' AI clients read their organization's data; Auth0
>   is the authorization server"
> - **Not specified here:** the UI layout (needs a comp, see "UI"); write tools; the Claude connectors
>   directory listing (later, separate).

## Outcome

A member can add Collega to the AI client they already use, sign in once, and ask it about their boards,
ideas, tasks and sprints, seeing exactly what they would see in the web app, with the organization in
control of whether that is allowed at all.

## Scope

- **In:** the `apps/mcp` server and its eight read tools; the bearer-token path on the API's nine read
  routes; the credential-check routes Auth0 calls; the organization switch; the connection list and revoke;
  per-call rechecks; rate limits; audit; escaping of user-written text; the Auth0 configuration the build
  depends on.
- **Out (v1):** any write tool; the Claude connectors directory listing; a second authorization server;
  email delivery; MCP resources and prompts (tools only); per-tool or per-board scopes; usage quotas by
  plan; Site Admin tools that span organizations in one call.
- **Unchanged:** the web sign-in (cookie, 8-hour JWT, `SecurityStamp`) and the deferred Entra ID sign-in in
  `20-feature-oauth.md`. This feature is an authorization server for *MCP access*, not a way to sign in to
  the web app.

## Shape

```
AI client ──MCP (Streamable HTTP, bearer)──▶ apps/mcp ──HTTPS, same bearer──▶ apps/api ──▶ application ──▶ DB
     │                                       (own Vercel project,               (AuthGuard: the only
     └──OAuth 2.1 + PKCE──▶ Auth0 ──verify──▶ mcp.collega-ai.com)                      reader of a credential)
                              (custom database: POST /api/v1/mcp-auth/verify on apps/api)
```

`apps/mcp` is HTTP-only like `apps/web`: it imports nothing from the workspace, holds no business rule, and
asks the API for everything. The API stays the only thing that talks to the database.

## Requirements

### Access

1. MCP is **off by default** in every organization. An Org Admin of that organization turns it on and off.
   Turning it off takes effect on the next call and leaves the connection records in place.
2. These may connect: an active **Org Admin, User or Read Only** in an organization with MCP on; and a
   **Site Admin, read-only**, naming one organization per call, in an organization with MCP on
   (owner decision 2026-10-26: the switch governs Site Admins too).
3. **Never:** an inactive user; a user who must still change their password; an archived organization;
   a View As session (an MCP token carries no impersonation, and no tool offers it).
4. **Read-only.** Every tool is a read. The API accepts an MCP token only on the nine routes in
   `contracts/mcp.md` "Routes an MCP token may call", marked `@AllowMcpToken()`; every other route, present
   or future, refuses it. The default is closed.
5. An MCP caller sees exactly what the same user sees in the web app: the tools call the same use cases, so
   organization, role and board rules apply unchanged. The role is read live, never taken from the token.

### Identity (Auth0)

6. **Auth0 is the authorization server**, with **a separate tenant for development and for production**
   (owner decision 2026-10-26, after weighing one tenant). Collega stays the only place a password lives:
   each tenant has one **custom database connection** whose login script calls `POST /api/v1/mcp-auth/verify`
   on that environment's API. No user is imported and no password is stored in Auth0. Two tenants because
   MCP clients are third-party applications, which Auth0 lets use only tenant-wide (domain-level)
   connections, so one tenant cannot keep a dev and a prod connection apart (*Open 2*).
7. `POST /api/v1/mcp-auth/verify` and `POST /api/v1/mcp-auth/profile` are server-to-server routes for Auth0
   alone, guarded by a shared secret the API reads in the auth folder. Verification answers one uniform
   failure for a wrong password, an unknown email, an inactive user, a must-change-password user and an
   organization with MCP off; shares the login limiter (per email and per IP); and never persists or logs the
   password. It is a credential-check oracle, so the secret, the limiter and the uniform answer are the
   defence.
8. A **post-login Action** adds two claims: `https://collega.app/uid` (the Collega user id) and
   `https://collega.app/stamp` (the user's `SecurityStamp` at sign-in). Nothing else about the user (not role,
   not organization) is trusted from the token.
9. **Tokens.** JWT access token; audience is the MCP resource URI (`https://mcp.collega-ai.com/mcp`); one scope,
   `collega:read`; lifetime **15 minutes**. Refresh tokens rotate with reuse detection (Auth0 setting);
   `offline_access` is requested by clients and is not listed in the server's scope metadata.
10. **Client registration:** Client ID Metadata Documents only for now (owner decision 2026-10-26).
    Dynamic Client Registration stays off (Auth0 ships it off, and it forces the tenant-wide connection
    promotion); it is enabled later only if a client we must support cannot connect. An unregistered client
    cannot reach consent.
11. `apps/mcp` serves OAuth Protected Resource Metadata (RFC 9728) naming the Auth0 tenant, answers an
    unauthenticated or rejected request with `401` and a `WWW-Authenticate: Bearer resource_metadata=…, scope="collega:read"`,
    and forwards the caller's bearer to the API unchanged. **The API is the validator:** signature (JWKS),
    issuer, audience, expiry. A token for any other audience is refused.

### Revocation

12. On **every** MCP-token request the API also checks: the user exists and is Active; the `stamp` claim equals
    the user's current `SecurityStamp`; the user's organization is not archived and has MCP on; the user's
    connection for this client is not revoked. Failures answer `401` (the client re-authorizes), except an
    organization with MCP off, which answers `403` keyed `mcp_disabled`. A password change or reset
    regenerates the stamp, so every connected AI client loses access on its next call. **Revocation is
    therefore bounded by one call, not by the 15-minute token life**, and does not depend on how Auth0
    treats a refresh.
13. A **connection** is one user's grant to one client. It is recorded the first time a token for a new
    (user, Auth0 client id) is seen, carries the client's display name and `lastUsedAt` (written at most once
    an hour), and can be revoked by its user or by an Org Admin of the organization. Revoking marks it revoked
    at once and asks Auth0 to delete the grant, best effort and audited.
14. Revoking, disabling MCP or deactivating a user ends access without touching the user's web session.

### Limits and size

15. **60 calls a minute per user and 600 a minute per organization**, counted on the API for MCP-token
    requests in a bucket of their own (the web app is unaffected). Over the limit: `429` with `Retry-After`.
    The numbers are starting values to tune from the audit.
16. A list tool returns at most 50 rows (default 25) with an opaque cursor. A user-written field is cut at
    4,000 characters with `truncated: true`. A result over 50 KB is refused with a message to narrow the
    request. Each tool makes **one** API call, except `get_idea`, which makes at most three.

### Audit

17. Audited, never with query text, arguments or returned content: `McpEnabled`, `McpDisabled`,
    `McpConnectionCreated`, `McpConnectionRevoked` (by self or by admin, with who), and **one `McpToolCalled`
    per call** carrying actor, organization, tool name, result count and whether it was refused. Per-call rows
    are the retention question in Open 7.

### Untrusted content

18. Idea titles, descriptions, proposed solutions, comment bodies and tag, user and board names are written
    by members and reach a model. Every such string in a result is returned **wrapped and escaped**:
    `<untrusted field="…">…</untrusted>`, with `<`, `>` and `&` in the text escaped so the text cannot close
    or forge the wrapper. The wrapping is not configurable. It lowers instruction-injection risk and does not
    remove it; the tool descriptions say the content is data.

### Deployment

19. `apps/mcp` is its own Vercel project on **`mcp.collega-ai.com`**, built on `mcp-handler` and
    the MCP SDK (1.26 or later) over **stateless Streamable HTTP**, with Fluid compute and no Redis. The URL
    is the token audience, so it is fixed before the first customer connects.
20. Layer rules, enforced rather than conventional: `apps/mcp` may import nothing from the workspace (a
    `biome.json` restriction plus an assertion in `tools/arch`); the bearer path lives in the auth folder and
    `tools/arch/identity-chokepoint.test.ts` is extended to cover it; the API's production connection cap
    (`connection_limit=1`) is a known pressure point for call bursts and is why rule 16 caps calls per tool.

## Edge cases

1. A user's role changes while connected: the next call uses the new role. A user who becomes Read Only
   keeps access to reads only, which is all there is.
2. A user's organization is archived or MCP is switched off: `403 mcp_disabled` / `401`, per rule 12.
3. A Site Admin omits `organizationId`, or names an organization with MCP off: a tool error, no data.
   A non-Site-Admin who passes `organizationId` for another organization: a tool error, not an existence leak.
4. Auth0 is down: new sign-ins fail and refreshes fail; a token already issued works until it expires.
   Collega is down: verification fails, so sign-in fails.
5. The same user connects from two clients: two connections, revoked independently.
6. A token is valid but the user has no connection record yet (first call): created, then the call proceeds.
7. Email is not the key: the `uid` claim is. A user whose email Auth0 knows differently still resolves to
   the one Collega user.
8. A must-change-password user is refused at sign-in (rule 3) and, if they become one later, at the next
   call (the stamp changes when the password does).

## Data model (proposal)

The next S0.2 amendment, as the following and board-idea-type amendments were:

- `organizations.mcp_enabled` boolean, default `false`.
- `mcp_connections`: `id`, `user_id`, `organization_id`, `auth0_client_id`, `client_name`, `created_at`,
  `last_used_at`, `revoked_at`, `revoked_by_user_id`; unique on (`user_id`, `auth0_client_id`).
- Audit actions listed in rule 17.

No token, secret or password column.

## UI

The layout is not settled, so a throwaway comp in `SPEC/mockups/` is reviewed before any React. Three
surfaces: **Organization settings → AI connections** (Org Admin: the on/off switch and every member's
connections with Revoke); **Profile → Connected apps** (each member's own, with Revoke); and a plain
"Connect Collega to your AI client" help panel that shows the server URL. The consent and sign-in screens
are Auth0's hosted pages, so Collega's wording there is Auth0 branding, not React.

## Build split (proposed)

1. **Spec** (this) and the decision entry.
2. **Backend A:** the migration, organization switch and connection routes, audit.
3. **Backend B:** the bearer path, `@AllowMcpToken()`, the per-call checks, the MCP rate-limit bucket, the
   `mcp-auth` routes, the identity-chokepoint test.
4. **Auth0 runbook:** `SPEC/50-auth0-mcp-runbook.md` — connection, API, Action, Applications, settings.
5. **`apps/mcp`:** skeleton, metadata, deploy, the boundary rules.
6. **The eight tools,** with wrapping, paging and size caps.
7. **QA** for 2, 3, 5 and 6: hermetic, Auth0 replaced by a local JWKS fixture, no network.
8. **Comp, then UI** for the three surfaces, then **UI QA**.
9. **Smoke:** a manual pass with MCP Inspector and at least two real clients (not part of `pnpm check`).

## Acceptance criteria

- [ ] MCP is off in every organization until an Org Admin turns it on; off answers `403 mcp_disabled`
- [ ] Org Admin, User and Read Only connect in their own organization; a Site Admin reads one named
      organization; an inactive or must-change-password user cannot sign in through Auth0
- [ ] An MCP token is refused on every API route except the nine marked `@AllowMcpToken()`, including
      routes added later
- [ ] A token for another audience, an expired token and a tampered token each answer `401`
- [ ] A password change makes the user's next MCP call answer `401`; deactivating a user does the same
- [ ] Revoking a connection ends that client's access on its next call and leaves the user's other
      connections and web session alone
- [ ] The 61st call in a minute for a user, or the 601st for an organization, answers `429` with `Retry-After`
- [ ] Every tool result wraps and escapes user-written text; a comment containing the closing tag cannot
      break out of the wrapper
- [ ] No result, audit row or log line contains a token, a password, query text or returned content
- [ ] `apps/mcp` imports nothing from the workspace and the check fails if it does
- [ ] Verification answers one identical failure for every refusal reason, and is limited per email and IP
- [ ] A real client completes sign-in and calls all eight tools against a deployed environment

## Open points

Settled 2026-10-26 and removed from this list: the domain (`mcp.collega-ai.com`), tenancy (two tenants),
the three new dependencies (`mcp-handler`, `@modelcontextprotocol/sdk` 1.26 or later, `jose`), Site Admin
reads needing the switch on, and CIMD-only registration.

1. **Auth0 plan and cost.** Budgeted as Professional (about $240 a month for B2C) for each paid tenant. Before
   the first backend slice, confirm on Auth0's own pricing page or with sales that the plan includes custom
   database connections in both tenants, and the per-member price. Third-party guides disagree on several
   figures.
2. **Domain-level connection and CIMD clients.** Auth0 says third-party applications use only domain-level
   connections. Confirm that a client registered by Client ID Metadata Document is third-party, so the
   connection is promoted in each tenant; the design assumes it is.
3. **Refresh and the stamp claim.** Confirm whether the post-login Action runs on a refresh exchange. The
   design does not depend on it (rule 12), but a refreshed token would carry a stale stamp and force a
   re-authorization.
4. **DNS and Vercel.** `mcp.collega-ai.com` needs a DNS record and a custom domain on the new project;
   `api.collega-ai.com` never resolved (`50-vercel-deployment.md`), so check the zone first.
5. **UI comps** for the three surfaces.
6. **Privacy and terms.** Auth0 becomes a processor of member emails and sign-in metadata; the privacy
   policy and subprocessor list need updating before launch.
7. **Retention of `McpToolCalled` rows.**
8. **Refresh-token lifetime** (idle and absolute) in Auth0. Proposed: 30 days idle, 90 days absolute.

## Answered 2026-10-26

Interview, one question at a time: Auth0 with a custom database (Collega keeps passwords); the server is a
new `apps/mcp`; v1 is read-only; Org Admin opt-in; Site Admins connect read-only; access ends within minutes
(15-minute tokens plus a per-call recheck); one Auth0 tenant for all environments; directory listing later
and not in this spec; the core eight tools; 60 per user and 600 per organization per minute; audit of
connections and calls without content; `mcp.collega-ai.com`; escape and label user-written text.

Blockers, same day: separate dev and prod Auth0 tenants (recommended over one tenant, which could not keep
two database connections apart for third-party clients); Professional budgeted for each paid tenant;
`mcp.collega-ai.com`; all three dependencies approved; the organization's switch governs Site Admins too;
Client ID Metadata Documents only.
