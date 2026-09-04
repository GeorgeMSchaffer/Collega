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

```bash
dotnet build Collega.sln
dotnet test Collega.sln   # the whole suite: Domain, Application, Infrastructure, API
```

`tests/Collega.E2E.Tests` is **Playwright for .NET**, skipped by default, so the line above
compiles it without needing a browser or a running server. See `tests/CLAUDE.md`.

There is no `package.json` and no npm script — the TypeScript stack does not exist yet. When it
does, the commands live here alongside these, not instead of them, until cutover.

**No local `dotnet`?** `docker compose --profile full up -d api` runs the API on the SDK image,
migrations and seed included (`src/Collega.Infrastructure/CLAUDE.md`). Behind a TLS-inspecting
proxy, drop the CA into `docker/proxy-ca/` first; the container build needs `--network host` and
the proxy variables or NuGet restore fails.

Running the API or Client, required configuration and secrets, seeding flags, migrations, and the local PostgreSQL container are all documented where they belong: `src/Collega.API/CLAUDE.md`, `src/Collega.Infrastructure/CLAUDE.md`, `src/Collega.Client/CLAUDE.md`, `tests/CLAUDE.md`, and `README.md`.


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

Layered with strict boundaries — business rules live in Domain and Application, never in controllers or UI components. Each project's own `CLAUDE.md` has its layout and conventions.

| Project | Role | Depends on |
|---|---|---|
| `src/Collega.API` | HTTP host, request boundary | Application, Infrastructure |
| `src/Collega.Application` | Use-case orchestration, authorization, validation | Domain |
| `src/Collega.Domain` | Entities, enums, value objects, invariants | nothing |
| `src/Collega.Infrastructure` | Persistence via **EF Core** on PostgreSQL, plus external integrations | implements Application/Domain abstractions |
| `src/Collega.Client` | Blazor WebAssembly UI (Fluent UI Blazor) | — |

These are the real project names, and the layering — not the ORM or the language — is what the
conversion preserves. `SPEC/50-typescript-migration.md` §4 maps each one onto its replacement.

## Technology Stack

**Two stacks are described below. Only the first one exists.** The whole application converts to
TypeScript in Sprint 9 (`SPEC/50-typescript-migration.md`) — a big-bang rewrite of ~60,000 lines,
not an incremental port — so until cutover, work against what is here and read the target as the
destination it is. Writing code against the second table today is the drift this section exists to
prevent.

### What the code is today

| | |
|---|---|
| Runtime | .NET 8 (`global.json` pins SDK 8.0.118) |
| Backend | ASP.NET Core Web API |
| Frontend | **Blazor WebAssembly**, Fluent UI Blazor — a client-side SPA, not Razor Pages |
| ORM | **EF Core** (Npgsql), migrations in `src/Collega.Infrastructure/Persistence/Migrations` |
| Database | PostgreSQL 16 — local in Docker with a persistent volume |
| Tests | xUnit, plus Playwright for .NET in `tests/Collega.E2E.Tests` (skipped by default) |
| Hosting | Azure, first deployed in Sprint 8 |

### What it converts to, in Sprint 9

| | |
|---|---|
| Runtime | Node.js **22.22.2** (what is installed and pinned in CI; `engines` allows >=22.18, so 24 is fine), TypeScript **5.9.3** |
| *Note on versions* | This row previously read "Node 24.x, TypeScript 7.x". **TypeScript 7.x is not usable here**: 7.0.x is the native port, its `"."` export is `lib/version.cjs` exporting only `{version, versionMajorMinor}`, so the compiler API is gone and `typescript-eslint` declares `typescript >=4.8.4 <6.1.0`. Corrected 2026-09-04 after S0.1 tried to build against it. |
| Frontend | Next.js + Tailwind CSS v4 + shadcn/ui, used as intended (`SPEC/decisions.md` 2026-09-03; comp Q is the reference rendering) |
| Backend | Nest.js, running serverless |
| ORM | Prisma |
| Database | PostgreSQL — Prisma Postgres in production |
| Tests | The .NET suite is **discarded** (ticket `10`): the golden corpus in `tools/golden` plus fresh per-slice Vitest |
| Hosting | Vercel |

The cutover **deletes the .NET solution**. Nothing runs side by side, and `SPEC/decisions.md`
2026-09-02 calls that the highest-risk change in the project. What survives it: `SPEC/`, the
`tools/golden` corpus that is the conversion's only oracle, and the database itself.

## Session, Branch, and Source Control

- Use feature branches per work item, named `feature/<NNN>-<short-description>`.
- Commit at logical checkpoints — completion of a feature or slice.
- The flow should be: Feature Branch -> Dev Branch --> Main branch

**During the conversion (from 2026-09-04):** all work lands on **`feature/typescript`**,
which is the main tree at `/home/user/Collega`. Conversion slices branch from it and merge
back to it — not to `dev`. At cutover it merges to `dev`, then `dev` to `main`.

| Path | Branch | What it is |
|---|---|---|
| `/home/user/Collega` | `feature/typescript` | Active work |
| `/home/user/collega-dotnet` | `legacy/dotnet` | Frozen .NET. Run the API here to re-record the golden corpus |

`legacy/dotnet` and `dev` both sit at `e8f6c4c`, the last .NET commit. **Never delete
`legacy/dotnet`** — it is the archival marker, because this repo's credentials reject tag
pushes. `SPEC/` diverges between the branches until cutover reconciles it; specs read from
`dev` after 2026-09-04 are a frozen snapshot.

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
