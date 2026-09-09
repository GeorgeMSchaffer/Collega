# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

This file carries only the rules that must be true *before* touching code. Reference detail lives closer to the code it describes — each `src/*` project, `tests/`, and `tests/Collega.E2E.Tests/` has its own `CLAUDE.md` covering that area's layout, conventions, commands, and gotchas. Read those when you work in them; don't duplicate them here.


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
pnpm dev          # apps/web on http://localhost:3000
pnpm check        # lint + typecheck + test — run this before calling anything done
pnpm build
pnpm test:e2e     # Playwright, separate because it needs a running app
```

`pnpm check` is the gate. It runs Biome (which also enforces the layer boundaries), `tsc` across
every package, and Vitest. There is no other build step.

### The .NET commands are frozen, not current

`dotnet build Collega.sln` still works, and the golden-capture harness still needs it to. But
`src/Collega.*` and `tests/` are **frozen** — see `SPEC/decisions.md` 2026-09-06 and the banner at
the top of each of their `CLAUDE.md` files. Do not build features, fix bugs, or write tests there.
They are deleted in slice **F6**, once F1 replays clean.

Until Waves D and E land, the .NET app is the only *runnable* full application, so `README.md` and
`demo.md` still document how to start it — as the thing to look at and re-record from, not to
extend.

## Repository State


Repo layout beyond the `src/` and `tests/` projects:

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

The frozen .NET projects map one-to-one onto these — `Collega.Domain` → `packages/domain`, and so
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

### The .NET stack (frozen)

`src/Collega.*`, `tests/`, `Collega.sln` and `global.json` are the .NET 8 / ASP.NET Core / Blazor
WebAssembly / EF Core application this replaces. **They are frozen and no longer applicable**
(`SPEC/decisions.md` 2026-09-06): read them only to learn what the old behaviour was, never as a
pattern. Every `CLAUDE.md` under `src/` and `tests/` carries a banner saying so.

Two things keep them on disk until slice **F6**:

- **The golden corpus is the conversion's only oracle.** Wave A recorded 447 cases across all 81
  endpoints × 4 roles on 2026-09-03 (`tools/golden`), and re-recording a missing or wrong one needs
  the .NET API to still boot. Waves D and E are exactly where such a gap surfaces.
- **It is the only runnable full application** until D and E land — the thing to look at when you
  need to know how a screen actually behaved.

The .NET test suite is **discarded**, not ported (ticket `10`). Cutover deletes the solution;
nothing runs side by side. What survives: `SPEC/` and `tools/golden`.

**The database is no longer on that list** (2026-09-09, `SPEC/decisions.md`). It was, while it held
the only copy of the demo data and could not be recreated. The seed modules now rebuild it from
committed code in under four seconds — `dropdb`, `db:migrate`, `db:seed` — so nothing about cutover
needs to preserve it. F3 and F4 should be planned on that basis: if the target is seeded fresh there
is no data to migrate.

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
