# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

This file carries only the rules that must be true *before* touching code. Reference detail lives closer to the code it describes — each `src/*` project, `tests/`, and `tests/Collega.E2E.Tests/` has its own `CLAUDE.md` covering that area's layout, conventions, commands, and gotchas. Read those when you work in them; don't duplicate them here.

## Repository State

Collega has a working solution with a large amount of implementation already merged — do not assume this is an early scaffold. **This file deliberately does not summarize implementation status**; any such summary goes stale, and a frozen snapshot here once caused a major planning error. `SPEC/implementation-agent-tracker.md`'s Current Status section is the single source of truth for "what's built" — read it fresh, per Ground-Truth Verification below.

Repo layout beyond the `src/` and `tests/` projects:

- `SPEC/` — canonical specs, the implementation tracker, and delivery/sprint plans (source of truth, see below)
- `SPEC/archive/` — **superseded documents; don't read unless asked for history.** Several assert the project is unstarted, which was true when written and is not now. Nothing here is canonical or gates work.
- `SPEC/mockups/` — SVG/HTML UI mockups and throwaway review comps
- `SPEC/SPECKIT/specs/<NNN-feature>/spec.md` — derived downstream copies of canonical `SPEC/*.md`; edit the canonical file first
- `e2e/` — TypeScript Playwright browser suite (see `e2e/README.md`), separate from `tests/Collega.E2E.Tests`
- `FluentUiComps/` — an unrelated spike, **not part of Collega**; don't change it as part of Collega work

Verify a file or project actually exists before assuming a command will work or a slice is unbuilt.

## Ground-Truth Verification

Before any status, planning, or scope claim about this project — in this session or any future one — re-read `SPEC/implementation-agent-tracker.md`'s Current Status section AND run `git log --oneline -10` fresh in that same turn. Never answer from recollection, even within the same conversation and even when confident.

This project routinely moves faster than any one conversation's memory of it; large batches land via parallel worktree agents, sometimes outside the thread asking the question. A large date jump, an unfamiliar recent commit, or "it's been a while since I checked" are signals to verify more, not less.

## Source of Truth

Canonical product behavior lives in `SPEC/*.md`. Read the relevant spec before describing or changing behavior. `SPEC/README.MD` indexes the full set; the ones that gate work:

- `SPEC/Bug Triage.md` — authoritative pre-feature bug/tweak queue. **Clear its `TODO` items before starting new features** unless the user explicitly approves an exception. After a fix passes focused validation, move the item to `COMPLETED` with date and verification note — never leave it in both sections.
- `SPEC/implementation-agent-tracker.md` — not product behavior, but the authoritative log of what's built, in progress, and next.
- `SPEC/95-next-sprints.md` — index for remaining pre-MVP sprint scope; per-sprint files live in `SPEC/sprints/` (completed ones in `SPEC/sprints/archive/`).
- `SPEC/30-Contracts.md` — canonical API route/payload contracts. Read before adding or changing an endpoint.
- `SPEC/40-test-strategy.md`, `SPEC/90-definition-of-done.md` — what must be covered, and what "done" means.

`SPEC/Specs Overview.md` is a **derived, non-canonical** summary — useful for orientation, never for implementation. Where it disagrees with a canonical spec, the canonical spec wins; that is precedence, not a conflict to raise.

If behavior is ambiguous, or **two canonical specs** conflict, ask before implementing.

## Product Model

Collega is an organization-scoped collaboration/idea-tracking tool, conceptually similar to Trello/Jira: organizations contain users, boards, statuses, and ideas; boards organize ideas by status using swimlanes. Full model in `SPEC/00-project-brief.md` and `SPEC/10-requirements.md`.

Two facts that constrain every change:

- **Roles**, most to least privileged: **Site Admin** (global, not organization-owned) → **Org Admin** (own org only) → **User** → **Read Only**. Every non-Site-Admin user belongs to exactly one organization and one role; email is globally unique system-wide. Scope every query and mutation accordingly.
- **Explicitly deferred — don't build without an explicit ask:** OAuth/SSO, SAML, reporting, guaranteed outbound email delivery, remember-this-device.

## Architecture

Layered with strict boundaries — business rules live in Domain and Application, never in controllers or UI components. Each project's own `CLAUDE.md` has its layout and conventions.

| Project | Role | Depends on |
|---|---|---|
| `src/Collega.API` | HTTP host, request boundary | Application, Infrastructure |
| `src/Collega.Application` | Use-case orchestration, authorization, validation | Domain |
| `src/Collega.Domain` | Entities, enums, value objects, invariants | nothing |
| `src/Collega.Infrastructure` | Persistence, external integrations | implements Application/Domain abstractions |
| `src/Collega.Client` | Blazor WebAssembly UI (Fluent UI Blazor) | — |

Stack: .NET 8, ASP.NET Core API, Blazor (Fluent UI Blazor), EF Core, SQL Server 2022, xUnit.

Client design direction is **Comp C "Fluent Editorial"**, locked and documented in `SPEC/20-feature-client-ui.md` and `src/Collega.Client/CLAUDE.md` — read those before UI work rather than inferring from mockup filenames.

## Working Rules

- Treat `SPEC/*.md` as the source of truth. If implementation changes behavior, update the canonical spec first, then align tests and implementation.
- Always seek clarification before implementing ambiguous or conflicting behavior.
- Make surgical changes; avoid unrelated refactors.
- Do not add NuGet packages without approval.
- Keep business rules in Application/Domain; keep API controllers thin; keep Blazor components focused on rendering and user interaction.
- Use DbContext + LINQ for data access; `async`/`await` for all database and I/O operations; EF Core migrations for schema changes.
- Unit tests must be hermetic — no network, filesystem, `DateTime.Now`, or randomness. See `tests/CLAUDE.md`.
- Stop any API or `dotnet watch` process you started before finishing.

## Coding Standards

- Follow .NET runtime coding style (https://github.com/dotnet/runtime/tree/main/docs/coding-guidelines) and existing repo patterns.
- Prefer clear, minimal code over broad rewrites.
- SQL: UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.
- Keep comments rare and only where the code needs clarification.
- Never commit secrets or temporary files.

## Build and Test

```bash
dotnet build Collega.sln
dotnet test Collega.sln
```

Running the API or Client, required configuration and secrets, seeding flags, migrations, and the local SQL Server container are all documented where they belong: `src/Collega.API/CLAUDE.md`, `src/Collega.Infrastructure/CLAUDE.md`, `src/Collega.Client/CLAUDE.md`, `tests/CLAUDE.md`, and `README.md`.

## Session, Branch, and Source Control

- Use feature branches per work item, named `feature/<NNN>-<short-description>`.
- Commit at logical checkpoints — completion of a feature or slice.

After build and tests pass on a feature branch:

1. Create a PR to `main`.
2. Merge the feature branch into `dev`.
3. Resolve conflicts using repo rules — server-side code: prefer `dev` where it moved ahead; `SPEC/` and `src/Collega.Client/`: prefer the feature branch.
4. Push `dev`.
5. Report the merge commit hash in your completion message.

## Multi-Agent Worktree Workflow

For epic-level work, split execution across role-based subagents, each in its own git worktree branched off `dev`:

- **Backend Developer** — Domain/Application/Infrastructure/API tasks.
- **QA Developer** — tests for the same slice, per `SPEC/40-test-strategy.md`.
- **UI/UX Developer** — Blazor components for client-facing scope. If a page or flow's layout isn't settled, produce a throwaway HTML comp in `SPEC/mockups/` for review first rather than writing production Blazor against an undecided design.
- **Code Reviewer** — gates the other three; reviews each finished branch (diff, build, tests, spec conformance) before it merges. Not a parallel implementer.

Rules:

- Each implementer gets its own worktree so they don't collide mid-flight.
- A role sits out a round if the sprint has no task for it — check the sprint's own file in `SPEC/sprints/` before assigning UI/UX work, and don't parallelize downstream UI work early.
- Code Reviewer must approve before merge.
- Once merged into `dev`, delete both the worktree and the branch. Don't leave merged worktrees around.
- This merges directly into `dev` per finished slice; it skips the per-branch PR-to-`main` step above. That still happens once per epic, when exit criteria are met.
- Update `SPEC/implementation-agent-tracker.md` as slices start and finish.
