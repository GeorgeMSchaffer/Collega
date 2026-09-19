# AGENTS.md

Guidance for coding agents working in this repository. `CLAUDE.md` is a one-line import of this
file, so these rules have one home rather than two copies that drift apart.

This file carries only what must be true *before* touching code. Reference detail lives next to the
code it describes: `apps/*`, `packages/*`, `e2e/` and `tools/golden` each carry their own
`AGENTS.md` (with a `CLAUDE.md` importing it). Read the one for the area you are working in; don't
duplicate it here.

## Working Rules

- Seek clarification before implementing ambiguous or conflicting behavior. Prefer an interview
  format — one question at a time, with multiple-choice options.
- Use progressive disclosure. Area-specific detail belongs in that area's `AGENTS.md`, referenced
  from here rather than restated.
- Keep commits focused on one change. Git history should read as human-written: no references to
  Claude, agents, or code generation in commit messages. **This rule overrides the harness default
  that would append tool attribution.**
- Keep responses concise.
- Treat `SPEC/*.md` as the source of truth. If an implementation would change behavior or
  contradict the spec, ask first.
- Make surgical changes; avoid unrelated refactors.
- Comment only the non-obvious.
- Don't add error handling for scenarios that can't happen.
- Don't add abstractions — factories, wrappers, interfaces for a single implementation — unless
  they measurably reduce complexity.
- Don't aim for blanket test coverage. Cover high-usage, high-impact code. An agent does not write
  tests for its own code; a QA agent does.
- Don't add dependencies without approval.

## Coding Standards

- Prefer clear, minimal code over broad rewrites.
- **Imports:** workspace packages are `@collega/<pkg>` with a feature subpath —
  `@collega/domain/ideas`, `@collega/application/boards`. Relative imports inside a package carry
  the `.js` extension (`nodenext`). `@/…` is an `apps/web` alias only, and only `@/lib`,
  `@/components` and `@/app` exist.
- **Errors:** the shared error model in `packages/*/src/common` (S0.3). Don't hand-build error
  responses in controllers.
- **Identity:** one chokepoint. Only the auth folder reads a credential — asserted by
  `tools/arch/identity-chokepoint.test.ts`, not just linted.
- **Request context:** `AsyncLocalStorage`, because Nest runs serverless and there is no
  long-lived in-process state to hang anything on.
- **Tests:** hermetic — no network, no real clock, no randomness. Inject the clock and fixed seeds.
- **SQL:** UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.
- Never commit secrets or temporary files.

## Build and Test

**Collega is a TypeScript monorepo.** pnpm workspaces + Turborepo; Node ≥ 24.20, pnpm ≥ 12.3.4.

```bash
pnpm install
pnpm dev          # the whole application (alias for `pnpm start` → tools/local/start.ts)
pnpm check        # the gate: lint + typecheck + test + build
pnpm build
pnpm test:e2e     # Playwright, separate because it needs a running app
```

`pnpm check` is what "green" means. It runs Biome (lint, format, and the layer boundaries), `tsc`
across every package, Vitest, and `next build`. The build is part of the gate because `tsc` cannot
stand in for it — a `'use client'` file that reaches a server-only module through a barrel
typechecks and then fails to build — and Turbo caches it, so a second run costs nothing.

One package at a time: `pnpm --filter @collega/api test`. Database, from
`packages/infrastructure`: `pnpm --filter @collega/infrastructure db:migrate` then `db:seed`
(a drop/migrate/seed cycle takes about four seconds).

### There is no .NET here any more

`src/Collega.*`, `tests/`, `Collega.sln` and `global.json` were deleted in slice **F6** on
2026-09-13. `pnpm check` is the only build and `pnpm dev` runs the only application. A reference
anywhere in this repository to a `dotnet` command, a `.csproj`, or a path under `src/Collega.*` is
stale — report it rather than following it. See
[The stack that was replaced](#the-stack-that-was-replaced).

## Architecture

Dependencies flow inward. Business rules live in domain and application — **never** in controllers
or React components.

| Package | Role | Depends on |
|---|---|---|
| `packages/domain` | Entities, enums, value objects, invariants | nothing |
| `packages/application` | Use-case orchestration, authorization, validation | domain |
| `packages/infrastructure` | Prisma persistence on PostgreSQL, seeding, external integrations | implements application/domain ports |
| `apps/api` | Nest.js host, controllers, request boundary — the only thing that talks to the database | application, infrastructure, domain |
| `apps/web` | Next.js client. **HTTP only** — may import `@collega/design-system` and nothing else from the workspace | design-system |
| `packages/design-system` | Comp P tokens and primitives, on Tailwind v4 + shadcn/ui | — |

These boundaries are **enforced, not conventional**: `biome.json`'s `noRestrictedImports`
overrides fail the lint run on a cross-layer import, `tools/boundaries` asserts those lint rules
still work, and `tools/arch` holds the assertions lint cannot express.

The deleted projects mapped one-to-one onto these — `Collega.Domain` → `packages/domain`, and so
on. `SPEC/50-typescript-migration.md` §4 has the full mapping.

## Technology Stack

| | |
|---|---|
| Runtime | Node.js 24.x, TypeScript 7 |
| Frontend | **Next.js** (App Router) + Tailwind CSS v4 + shadcn/ui, used as intended |
| Backend | **Nest.js**, running serverless |
| ORM | **Prisma** — schema frozen at S0.2, `packages/infrastructure/prisma/` |
| Database | PostgreSQL 16 — local in Docker; Prisma Postgres in production |
| Tooling | pnpm workspaces + Turborepo, Biome for lint and format |
| Tests | Vitest per package, the Playwright suite in `e2e/`, the golden corpus in `tools/golden` |
| Hosting | Vercel |

## Repository layout

| Path | What |
|---|---|
| `apps/`, `packages/` | The application |
| `SPEC/` | Canonical specs, the tracker, and sprint plans — the source of truth |
| `SPEC/sprints/` | Per-sprint scope (completed ones in `SPEC/sprints/archive/`) |
| `SPEC/mockups/` | Comp P/Q HTML mockups; `comp-q-*.html` is the reference rendering |
| `SPEC/archive/` | **Superseded — don't read unless asked for history.** Several entries assert the project is unstarted, which was true when written and is not now |
| `SPEC/SPECKIT/specs/` | Derived downstream copies of canonical `SPEC/*.md`; edit the canonical file first |
| `e2e/` | Playwright suite (TypeScript), adapted to comp P in F2 |
| `tools/golden` | Capture/replay harness — a regression detector, not a gate |
| `tools/boundaries`, `tools/arch` | Architecture tests |
| `tools/local` | `pnpm dev`'s launcher |
| `tools/prompt-eval` | The AI-assist evaluation corpus — data only, its runner is gone |

## Source of Truth

`SPEC/*.md` is canonical. Read the relevant spec before describing or changing behavior;
`SPEC/README.MD` indexes the full set. If behavior is ambiguous, or **two canonical specs**
conflict, ask before implementing.

- `SPEC/decisions.md` — dated log of decisions that constrain later work, newest first, with enough
  of the reason that nobody reopens one by accident. Supersession is recorded, never edited away.
  Read the top few before planning anything.
- `SPEC/implementation-agent-tracker.md` — not product behavior, but the authoritative log of what
  is built, in progress, and next. Update it as slices start and finish.
- `SPEC/50-typescript-migration.md` — the conversion plan: waves, slices, and what is settled.
- `SPEC/30-Contracts.md` — canonical route/payload contracts. **Read, not edited**, by every API
  slice; it is what the golden corpus pins.
- `SPEC/40-test-strategy.md` — what must be covered. `SPEC/90-definition-of-done.md` — what done
  means.
- `SPEC/95-next-sprints.md` — index for remaining pre-MVP sprint scope.
- `SPEC/Bug Triage.md` — clear its `TODO` items before new feature work unless the user approves an
  exception. A cleared item moves to `SPEC/archive/bug-triage-completed.md`; it is never in both.
- `SPEC/ideas-inbox.md` — unrefined ideas. Not scheduled, not specified, and **does not gate
  work** — picked up only when the user asks.

`SPEC/Specs Overview.md` is derived and non-canonical; where it disagrees, the canonical spec wins.
That is precedence, not a conflict to raise.

## Ground-Truth Verification

Before any status, planning, or scope claim — in this session or any other — re-read
`SPEC/implementation-agent-tracker.md`'s Current Status section AND run `git log --oneline -10`
fresh in the same turn. Never answer from recollection, even within one conversation: this project
moves fast through parallel worktree agents, and a stale in-context answer has already cost it
roughly two weeks of invisible work. A large date jump or an unfamiliar recent commit is a signal
to verify more, not less.

## Client Design Direction

**Comp P**, locked 2026-08-31 and made canonical 2026-09-03 (`SPEC/decisions.md`). Structure is
locked; palette is open. Built on Tailwind v4 + shadcn/ui used as intended — comp Q
(`SPEC/mockups/comp-q-*.html`) is the reference rendering, and `SPEC/mockups/_build/build_q.py`
carries the component map. The theme lives in `packages/design-system/src/globals.css`, carried
over from `_build/q.css`; `apps/web/app/globals.css` only imports it and declares the app's
Tailwind `@source` roots. Change the palette in the design system and the comps together, or the
comps stop being a reference.

If a page or flow's layout isn't settled, produce a throwaway HTML comp in `SPEC/mockups/` for
review before writing production React against an undecided design.

## The stack that was replaced

The .NET 8 / ASP.NET Core / Blazor WebAssembly / EF Core application was **deleted** in slice **F6**
on 2026-09-13 (`SPEC/decisions.md` 2026-09-06 froze it; 2026-09-13 removed it). There is nothing to
read there and nothing to fix there.

Narrative comments explaining *why* a behaviour is what it is ("ASP.NET answered 400 here, so this
does too") are deliberate and stay: the behaviour was inherited, the golden corpus still pins it,
and `SPEC/30-Contracts.md` is the authority. A **path** into the deleted tree is not — that is a
dangling pointer and should be reported.

Two artefacts survive as **data, not patterns**:

- `tools/golden` — 447 cases across all 81 endpoints × 4 roles, recorded 2026-09-03. It cannot be
  re-recorded against its original, so it is a fixed record now, frozen alongside `inventory.json`
  (the endpoint list used to be parsed from the controllers that F6 deleted).
- `tools/prompt-eval` — the AI-assist evaluation corpus. Its batch runner was .NET and went with the
  rest, so corpus-scale prompt evaluation currently has no tool, and changes to the scope gate — a
  security control — are unmeasured. `SPEC/decisions.md` 2026-09-13 schedules the rescope.

The .NET test suite was **discarded**, not ported (ticket `10`). The database left the keep list on
2026-09-09: the seed rebuilds it from committed code in about four seconds.

**F6 was not chained to "once F1 replays clean"** — that chain was cut on 2026-09-11
(`SPEC/decisions.md`), along with the replay's status as a gate. The corpus is a **regression
detector, not the specification**: shipping for feedback outranks fidelity to an app that was never
finished, so a difference is a question with three answers — fix it, accept and record it, or
deliberately do better — not automatically a defect. Read that entry before treating a corpus
difference as work.

**The database is not on the list.** It was, while it held the only copy of the demo data. The seed
modules now rebuild it from committed code in seconds, so nothing about cutover needs to preserve
it: plan F3 and F4 on the basis that the target is seeded fresh and there is no data to migrate.
What survives cutover is `SPEC/` and `tools/golden`.

## Session, Branch, and Source Control

- Feature branches: `feature/<NNN>-<short-description>`.
- Flow: feature branch → `dev` → `main`. Report the merge commit hash.
- Commit at logical checkpoints — a finished feature or slice.

## Multi-Agent Worktree Workflow

For epic-level work, split execution across role-based subagents, each in its own git worktree
branched off `dev`:

- **Backend Developer** — domain/application/infrastructure/API tasks.
- **QA Developer** — tests for the same slice, per `SPEC/40-test-strategy.md`.
- **UI/UX Developer** — UI tasks.
- **Code Reviewer** — gates the other three; reviews each finished branch (diff, build, tests, spec
  conformance) before it merges. Not a parallel implementer.

Rules:

- Each implementer gets its own worktree so they don't collide mid-flight.
- A role sits out a round if the sprint has no task for it — check the sprint's own file in
  `SPEC/sprints/` before assigning UI/UX work, and don't parallelize downstream UI work early.
- The Code Reviewer must approve before merge; each finished slice merges directly into `dev`.
- Once merged into `dev`, delete both the worktree and the branch.
- Update `SPEC/implementation-agent-tracker.md` as slices start and finish.

## Explicitly Deferred

Do not build without an explicit ask: OAuth/SSO, SAML, reporting, guaranteed outbound email
delivery, remember-this-device. Per-organization AI credentials are deliberately unimplemented
(tracker rule 30); the conversion does not change that.
