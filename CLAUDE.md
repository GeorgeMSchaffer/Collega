# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

This file carries only the rules that must be true *before* touching code. Reference detail lives closer to the code it describes — `apps/web/AGENTS.md`, `e2e/README.md`, `tools/README.md` and the per-package notes cover their own area's layout, conventions, commands, and gotchas. Read those when you work in them; don't duplicate them here.


## Working Rules

- Always seek clarification before implementing ambiguous or conflicting behavior. When possible use a question by question multiple choice format.
- Use progressive disclosure. Information specific to project should be stored seperately and referenced as needed.
- Keep commits focused on one change. Git History should look human writen and avoid refrences to Claude or Code generation.
- Keep output concise when responding. 
- For asking clarifcation prefer an interview format with multiple choice options 
- Treat `SPEC/*.md` as the source of truth. If implementation changes behavior or contradicts the spec seek clarification.
- Make surgical changes; avoid unrelated refactors.
- Only comment the non-obivius.
- Don't add error handling for scenarios that can't happen.
- Do not create abstrctions unless they reduce complexity measurably and factories, also avoid interfaces for single implementations.
- We do not need to cover everything with a full suite of unit and e2e tests.  Instead we want to focus on high usage, high impact code.  Also an agent that edited the coded, should not write tests for their own code, use a seperate QA engineer to create tests.
- Use path aliases: `@/components`, `@/lib`, `@/server` instead of relative imports where possible.


## Coding Standards

- Prefer clear, minimal code over broad rewrites.
- SQL: UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.
- Never commit secrets or temporary files.

## Build and Test

**This is a TypeScript monorepo.** pnpm workspaces + Turborepo; Node ≥ 24.20, pnpm ≥ 12.3.4.

```bash
pnpm install
pnpm dev          # the whole application - an alias for `pnpm start`
pnpm check        # lint + typecheck + test — run this before calling anything done
pnpm build
pnpm test:e2e     # Playwright, separate because it needs a running app
```

`pnpm check` is the gate. It runs Biome (which also enforces the layer boundaries), `tsc` across
every package, Vitest, and `next build`. The build is part of the gate because `tsc` cannot stand in
for it — a `'use client'` file that reaches a server-only module through a barrel typechecks and
then fails to build — and Turbo caches it, so a second run costs nothing.

### There is no .NET here any more

`src/Collega.*`, `tests/`, `Collega.sln` and `global.json` were deleted in slice **F6** (2026-09-13).
`pnpm check` is the only build, and `pnpm start` runs the only application. A reference to a
`dotnet` command, a `.csproj`, or a path under `src/Collega.*` anywhere in this repository is stale
— report it rather than following it.

What the deletion deliberately kept: `SPEC/` (including the dated history in `decisions.md`, which
still describes the old stack because that is what happened), the golden corpus in `tools/golden`,
and the AI-assist evaluation corpus in `tools/prompt-eval`.


## Repository State


Repo layout beyond `apps/` and `packages/`:

- `SPEC/implementation-agent-tracker.md` Use to track the current state of development with upcoming and completed features
- `SPEC/` — canonical specs, the implementation tracker, and delivery/sprint plans (source of truth, see below)
- `SPEC/archive/` — **superseded documents; don't read unless asked for history.** Several assert the project is unstarted, which was true when written and is not now. Nothing here is canonical or gates work.
- `SPEC/mockups/` — SVG/HTML UI mockups and throwaway review comps
- `SPEC/SPECKIT/specs/<NNN-feature>/spec.md` — derived downstream copies of canonical `SPEC/*.md`; edit the canonical file first


## Source of Truth

Canonical product behavior lives in `SPEC/*.md`. Read the relevant spec before describing or changing behavior. `SPEC/README.MD` indexes the full set; the ones that gate work:
- `SPEC/decisions.md` — dated log of decisions that constrain later work, newest first, with enough of the reason that nobody reopens one by accident. Supersession is recorded, never edited away.
- `SPEC/ideas-inbox.md` — unrefined feature ideas. Not scheduled, not specified, and **does not gate work** — only picked up when the user asks.
- `SPEC/implementation-agent-tracker.md` — not product behavior, but the authoritative log of what's built, in progress, and next.
- `SPEC/95-next-sprints.md` — index for remaining pre-MVP sprint scope; per-sprint files live in `SPEC/sprints/` (completed ones in `SPEC/sprints/archive/`).
- `SPEC/30-Contracts.md` — canonical API route/payload contracts. Read before adding or changing an endpoint.
- `SPEC/40-test-strategy.md`, `SPEC/90-definition-of-done.md` — what must be covered, and what "done" means.

`SPEC/Specs Overview.md` is a **derived, non-canonical** summary — useful for orientation, never for implementation. Where it disagrees with a canonical spec, the canonical spec wins; that is precedence, not a conflict to raise.

If behavior is ambiguous, or **two canonical specs** conflict, ask before implementing.


## Architecture

Layered with strict boundaries — business rules live in Domain and Application, never in
controllers or UI components. The layering is what the conversion preserves; the language and ORM
are not.

| Package | Role | Depends on |
|---|---|---|
| `apps/web` | Next.js client. **HTTP only** — may import `@collega/design-system` and nothing else from the workspace | design-system |
| `apps/api` | Nest.js host, request boundary. The only thing that talks to the database | application, infrastructure, domain |
| `packages/application` | Use-case orchestration, authorization, validation | domain |
| `packages/domain` | Entities, enums, value objects, invariants | nothing |
| `packages/infrastructure` | Persistence via **Prisma** on PostgreSQL, plus external integrations | implements application/domain ports |
| `packages/design-system` | Tokens and primitives from comp P, on Tailwind v4 + shadcn/ui | — |

These boundaries are **enforced**, not conventional: `biome.json`'s `noRestrictedImports`
overrides fail the lint run on a cross-layer import, and `tools/boundaries` asserts the lint rules
themselves still work. `apps/web` reaching into `packages/application` is a lint error, and that is
deliberate (`SPEC/50-typescript-migration.md` §4.3).

The deleted projects mapped one-to-one onto these — `Collega.Domain` → `packages/domain`, and so
on. `SPEC/50-typescript-migration.md` §4 has the full mapping.

## Technology Stack

| | |
|---|---|
| Runtime | Node.js 24.x, TypeScript 7 |
| Frontend | **Next.js** (App Router) + Tailwind CSS v4 + shadcn/ui, used as intended. Comp P is the locked structure; comp Q (`SPEC/mockups/comp-q-*.html`) is the reference rendering |
| Backend | **Nest.js**, running serverless |
| ORM | **Prisma** — schema frozen at S0.2, `packages/infrastructure/prisma/` |
| Database | PostgreSQL 16 — local in Docker; Prisma Postgres in production |
| Tooling | pnpm workspaces + Turborepo, Biome for lint and format |
| Tests | Vitest per package, plus the Playwright suite in `e2e/`, plus the golden corpus in `tools/golden` |
| Hosting | Vercel |

### What the deleted stack left behind

The .NET 8 / ASP.NET Core / Blazor WebAssembly / EF Core application this replaced was deleted in
slice **F6** on 2026-09-13. Two of its artefacts survive, and both are **data, not patterns**:

- **The golden corpus** (`tools/golden`) — 447 cases across all 81 endpoints × 4 roles, recorded
  2026-09-03. It cannot be re-recorded against its original, so it is a fixed record now, frozen
  alongside `tools/golden/inventory.json`. **It is a regression detector, not the specification**
  (`SPEC/decisions.md` 2026-09-09): shipping for feedback outranks fidelity to the old app, so a
  diff is a question — fix it, accept and record it, or deliberately do better — rather than
  automatically a defect. Read that entry before treating a corpus difference as work.
- **The AI-assist evaluation corpus** (`tools/prompt-eval`) — nine cases and three fixtures. Its
  batch runner was .NET and went with the rest, so corpus-scale prompt evaluation currently has no
  tool. `tools/prompt-eval/README.md` says what that costs.

The .NET test suite was **discarded**, not ported (ticket `10`). The database was never on the
keep list after 2026-09-09 (`SPEC/decisions.md`): the seed modules rebuild it from committed code in
under four seconds — `dropdb`, `db:migrate`, `db:seed` — so nothing about cutover needed to preserve
it.


## Session, Branch, and Source Control

- Use feature branches per work item, named `feature/<NNN>-<short-description>`.
- Commit at logical checkpoints — completion of a feature or slice.
- The flow should be: Feature Branch -> Dev Branch --> Main branch

## Multi-Agent Worktree Workflow

 ### Agent Roles

For epic-level work, split execution across role-based subagents, each in its own git worktree branched off `dev`:

- **Backend Developer** — Domain/Application/Infrastructure/API tasks.
- **QA Developer** — tests for the same slice, per `SPEC/40-test-strategy.md`.
- **UI/UX Developer** — UI related tasks. 
- **Code Reviewer** — gates the other three; reviews each finished branch (diff, build, tests, spec conformance) before it merges. Not a parallel implementer.

### Multi Agent Rules


- Each implementer gets its own worktree so they don't collide mid-flight.
- A role sits out a round if the sprint has no task for it — check the sprint's own file in `SPEC/sprints/` before assigning UI/UX work, and don't parallelize downstream UI work early.
- Code Reviewer must approve before merge.
- Once merged into `dev`, delete both the worktree and the branch. Don't leave merged worktrees around.
- This merges directly into `dev` per finished slice;
- Update `SPEC/implementation-agent-tracker.md` as slices start and finish.
