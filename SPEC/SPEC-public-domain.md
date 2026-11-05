# Spec: public-domain

Status: draft for owner review. No implementation authorized.
Authority: `worksprint-phase-1-capability-map.md`, owner decisions 2026-11-05.
Dependencies: public-brand and marketing-site readiness before final cutover.

## Objective

Serve the new marketing site at https://worksprint.io and existing app at
https://app.worksprint.io. These replace the earlier .app targets.
Keep API/MCP hosts, environment keys, cookies and package identifiers unchanged.
Remove the old collega-ai.com app-domain binding only after verification.
No old-domain redirects are required; no domain registration or unrelated DNS
deletion is authorized.

## Tech stack and commands

Existing Vercel deployment, Next.js app and server-only API connection.
DNS records must come from the actual Vercel configuration, not guessed values.
Follow `50-vercel-deployment.md`, `50-cutover-runbook.md` and app guidance.

From repository root:

```powershell
pnpm check
curl.exe --head https://worksprint.io/
curl.exe --head https://app.worksprint.io/login
curl.exe --fail https://app.worksprint.io/robots.txt
curl.exe --fail https://app.worksprint.io/sitemap.xml
```

These checks supplement browser and deployment verification; a successful
HEAD request alone cannot establish login or submission correctness.
No DNS/Vercel mutation command is authorized by this draft.

## Project structure and code style

- `apps\web\lib\site-url.ts`, `app\sitemap.ts`, `app\robots.ts`:
  verify production origin resolution for the new application hostname.
- `apps\marketing`: corresponding public metadata and origin handling.
- App Vercel configurations and workspace build selectors: actual rebuilt
  deployments must pick up the approved configuration.
- `SPEC`: cutover evidence and rollback procedure; no secret values.

Keep the existing server-only API seam and formatting:

```typescript
export const SESSION_COOKIE_NAME = 'collega_session'
```

The literal stays unchanged intentionally. Browser requests remain same-origin
with the web app; don't add API CORS, shared-domain cookie scope or session
migration to perform this cutover.

## User-visible transition

The owner accepts one-time sign-in and theme reselection on app.worksprint.io.
Do not copy old-domain cookies or browser storage. Beta requests do not
create sessions. Marketing and app are distinct hosts, not host-aware variants
inside apps/web.

## Testing strategy

Before old-binding removal, check HTTPS and real deployment identities for
both hosts; correct marketing Login and app navigation links; registration,
login, forced password rotation, logout and theme persistence on the new app
host; correct production sitemap/robots origins; and synthetic beta intake
only after its pre-launch blockers are resolved.
QA tests origin generation hermetically; operator DNS/deployment checks are
separate from automated unit tests.

## Boundaries

- Always: preserve the old binding until app verification; inspect existing
  DNS/settings before changing them; verify a real rebuilt deployment.
- Ask first: execution of release/DNS mutations, new hostname scope,
  resource/project renames, credential rotation, www policy or redirect changes.
- Never: delete unrelated DNS/registrations, alter API/MCP hosts, migrate
  sessions, reseed production or publish secret configuration.

## Success criteria

1. worksprint.io serves the selected marketing build over HTTPS;
   app.worksprint.io serves the verified WorkSprint application.
2. Public links and app sitemap/robots identify the correct respective hosts;
   Preview/local origins do not leak into production search metadata.
3. Authentication and API access work on the new app host without changing
   technical identities, and accepted browser-state reset is documented.
4. Old collega-ai.com app binding is removed only after verification;
   no old-domain redirect or unrelated DNS deletion is introduced.
5. A reviewed rollback procedure records the previous binding/configuration
   and deployment before release; release execution requires owner approval.
6. Phase 2 remains unscheduled, with no automatic follow-up trigger.

## Open gates

Verify live DNS ownership and Vercel project settings before execution.
The www host policy and exact rollback steps remain plan-review questions.
Marketing privacy/provider setup gates must clear before enabling live signup.
Owner reviews this spec before the technical plan and task breakdown.
