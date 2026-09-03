# CLAUDE.md

Rules that must hold before touching code. Area detail lives next to the code in that area's own `CLAUDE.md` (or `README.md`): read the one for the area you're in, and don't duplicate it here. New `apps/*` and `packages/*` get their own as they are created.

## Working Rules

- `SPEC/*.md` is the source of truth. Read the relevant spec before describing or changing behavior, and update it first when behavior changes. If behavior is ambiguous or two canonical specs conflict, ask before implementing — one question at a time, multiple choice where possible.
- Before any status or planning claim, re-read the Current Status section of `SPEC/implementation-agent-tracker.md` and run `git log --oneline -10` fresh. Never answer from memory.
- Before starting feature work, clear the `TODO` items in `SPEC/Bug Triage.md` unless the user approves an exception.
- Make surgical changes; no unrelated refactors. Comment only the non-obvious. No error handling for cases that can't happen. No abstractions, factories, or interfaces for a single implementation unless they measurably reduce complexity.
- Never commit secrets or temporary files. One focused change per commit, written in a human voice with no reference to Claude or code generation.
- Keep responses concise.

## Specs

`SPEC/README.MD` indexes everything. The files that gate work:

- `implementation-agent-tracker.md` — what's built, in progress, and next
- `95-next-sprints.md` — remaining sprint scope; per-sprint files in `sprints/`, completed ones in `sprints/archive/`
- `50-typescript-migration.md` — the conversion plan: target layout, wave order, collision model, cutover
- `30-Contracts.md` — API routes and payloads; read before adding or changing an endpoint
- `40-test-strategy.md`, `90-definition-of-done.md` — what must be covered and what "done" means
- `decisions.md` — dated decisions; read before reopening a settled question

`Specs Overview.md` is derived and non-canonical: where it disagrees with a canonical spec, the canonical spec wins. `ideas-inbox.md` gates nothing. `archive/` is history — don't read it unless asked. `SPECKIT/specs/*/spec.md` are downstream copies; edit the canonical file first.

## Stack and Architecture

Node.js 24 · TypeScript 7 · Next.js (`apps/web`) · Nest.js (`apps/api`) · Prisma on PostgreSQL · Vitest · Playwright · Vercel. Imports use path aliases (`@/components`, `@/lib`, `@/server`), not relative paths.

Layered with strict boundaries, enforced by `eslint-plugin-boundaries`. Business rules live in `domain` and `application` only — never in controllers or UI components.

| Package | Role | Imports |
|---|---|---|
| `packages/domain` | Entities, enums, invariants | nothing |
| `packages/application` | Use cases, authorization, validation; owns the abstractions | `domain` |
| `packages/infrastructure` | Prisma client, repositories, integrations | implements `application` / `domain` abstractions |
| `packages/design-system` | Tokens and primitives from comp P | — |
| `apps/api` | Nest.js; the only thing that talks to the database | `application`, `infrastructure` |
| `apps/web` | Next.js; reaches the server over HTTP only | `design-system` |

Layout and layer rules: `SPEC/50-typescript-migration.md` §3. `prisma/schema.prisma` is the most contended file in the repo; see §4 before touching it.

**Legacy .NET tree.** `src/Collega.*`, `tests/`, and `Collega.sln` are the .NET 8 / Blazor solution the conversion replaces. It is the golden-capture oracle (`tools/golden/`) until cutover deletes it, so it stays buildable but gets no new features. Its per-project `CLAUDE.md` files still describe it; `dotnet test Collega.sln` is its check. The `e2e/` Playwright suite is kept through the conversion (`e2e/README.md`).

## Branches

`feature/<NNN>-<short-description>` → `dev` → `main`. Conversion slices merge to `dev` directly, not to an integration branch (`decisions.md`, 2026-09-02). Commit at logical checkpoints — a finished feature or slice.

## Multi-Agent Worktree Workflow

Epic-level work splits across role agents, each in its own worktree branched off `dev`:

- **Backend Developer** — `packages/*` and `apps/api`.
- **QA Developer** — tests for the same slice, per `SPEC/40-test-strategy.md`. The agent that wrote the code never writes its tests.
- **UI/UX Developer** — `apps/web`. Only if the sprint file in `SPEC/sprints/` has a UI task, and never ahead of the API it depends on.
- **Code Reviewer** — reviews each finished branch (diff, build, tests, spec conformance) before merge. A gate, not a parallel implementer.

Each approved slice merges directly into `dev`; then delete the worktree and branch. Update `SPEC/implementation-agent-tracker.md` as slices start and finish.
