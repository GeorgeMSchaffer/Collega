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
npm run tests:unit #runs unit tests
npm run tests:e2e #runs e2e test via Cypress
npm run test #runs the whole suite
dotnet test Collega.sln
```

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
- `SPECT/decisions` - Records decision made with the date when it was made and a concise explantion.
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
| `src/API` | HTTP host, request boundary | Application, Infrastructure |
| `src/Application` | Use-case orchestration, authorization, validation | Domain |
| `src/Domain` | Entities, enums, value objects, invariants | nothing |
| `src/Prisma` | Persistence via Prisma / PostGress |  external integrations | implements Application/Domain abstractions |
| `src/Web` | Blazor WebAssembly UI (Fluent UI Blazor) | — |

## Technology Stack
- Node.js 24.x with Typescript 7.x
- Frameworks
    -- Frontend:  Next.js and CSS framework (decided later)
    -- Backend:  Nest.js
    -- ORM: Prisma Posgress
    -- Database: 
        -- Local:  Postgress on a docker container with persisten storage.
        -- Prod:  Prisma Postgress on Vercel
    -- Hosting: Vercal.

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
