# Agent guidance

`CLAUDE.md` imports this file. Read the closest `AGENTS.md` before working in an area; these
instructions keep only repository-wide rules and point to conditional detail.

## Working rules

- Treat canonical `SPEC/*.md` as product authority. Read the relevant spec before describing or
  changing behavior; ask the user before resolving ambiguous or conflicting intent.
- Make focused, minimal changes. Verify claims; comment only non-obvious code. Avoid error handling
  for impossible cases and abstractions that do not measurably reduce complexity.
- Do not add dependencies without approval, commit secrets or temporary files, or write tests for
  code you implemented. High-impact tests belong to a QA agent.
- Keep commits focused and human-written; omit AI or agent attribution.

## Architecture and conventions

Dependencies flow inward: `packages/domain` owns pure business rules; `packages/application`
orchestrates use cases and authorization; `packages/infrastructure` implements their ports;
`apps/api` is the request and database boundary; `apps/web` uses HTTP and may import only
`@collega/design-system` from the workspace. The design system is consumed only by the web app.
Biome and architecture tests enforce these boundaries.

- Import workspace packages through `@collega/<package>/<feature>` subpaths. Relative imports
  inside packages use `.js` extensions; `@/…` is an `apps/web` alias for `@/lib`, `@/components`
  and `@/app`.
- Use the shared error model in `packages/*/src/common`; controllers do not construct error
  responses. Only the auth folder reads credentials, enforced by
  `tools/arch/identity-chokepoint.test.ts`.
- Request context uses `AsyncLocalStorage`. Keep tests hermetic: inject clocks and fixed IDs/seeds;
  use no network, real clock or randomness.
- SQL uses uppercase keywords, lowercase identifiers, meaningful aliases, and no `SELECT *`.

## Specifications and status

`SPEC/README.MD` is the index. Read the relevant canonical spec and `SPEC/decisions.md` before
reopening a settled decision. `SPEC/Specs Overview.md` and `SPEC/SPECKIT/specs/` are derived;
canonical specs win. Read `SPEC/archive/` only for requested history. API slices read, but do not
edit, `SPEC/30-Contracts.md` and `SPEC/contracts/`.

Before feature work, clear `TODO` items in `SPEC/Bug Triage.md` unless the user approves an
exception. Move completed items to `SPEC/archive/bug-triage-completed.md`; promoted items leave the
queue, and an item must never live in both. `SPEC/ideas-inbox.md` is unscheduled and does not gate
work.

Before any status, planning or scope claim, reread the tracker's **Current Status** and run
`git log --oneline -10` in the same turn. Investigate unfamiliar history or date gaps. Update
`SPEC/implementation-agent-tracker.md` as slices start and finish; route completed rows and
narratives to `SPEC/tracker-history.md`.

## Conditional guidance

- For UI or design-system work, read `apps/web/AGENTS.md` and
  `packages/design-system/AGENTS.md`. Get a reviewed throwaway HTML comp in `SPEC/mockups/` before
  implementing a page or flow whose layout is unsettled.
- For deployment, Vercel configuration, or environment-only changes, read the relevant app
  guidance and `SPEC/50-vercel-deployment.md` §2.
- For epic-level, role-based work across multiple worktrees, read `AGENT-WORKFLOW.md`.
- Before using the golden replay harness, read `tools/golden/README.md` and
  `tools/golden/AGENTS.md`. Its recorded corpus is frozen data, not a gate or specification.
  Prompt changes are measured against the committed v1 baseline in `tools/prompt-eval`.

OAuth/SSO, SAML, guaranteed outbound email delivery and remember-this-device remain deferred.
Per-organization AI credentials remain unimplemented; do not build either without an explicit ask.

`pnpm check` is the completion gate (lint, typecheck, tests and build); run the browser E2E suite
separately when the change requires it.
