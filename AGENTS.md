# AGENTS.md

## The stack

**Collega is a TypeScript monorepo.** pnpm workspaces + Turborepo, Node ≥ 24.20, pnpm ≥ 12.3.4.

The .NET application in `src/Collega.*` and `tests/` is **frozen** — it is being replaced, not
maintained. See [The frozen .NET stack](#the-frozen-net-stack) below before you touch anything
there.

## Build and Test

```bash
pnpm install
pnpm dev          # apps/web on http://localhost:3000
pnpm check        # lint + typecheck + test — the gate
pnpm build
pnpm test:e2e     # Playwright; needs a running app
```

`pnpm check` is what "green" means: Biome (lint + format + layer boundaries), `tsc` across every
package, and Vitest. Run it before calling work done. A single package: `pnpm --filter @collega/api test`.

## Architecture

Dependencies flow inward. The boundaries are enforced by lint, not convention.

| Package | Role |
|---|---|
| `packages/domain` | Entities, enums, value objects, invariants — depends on nothing |
| `packages/application` | Use cases, authorization, validation — depends on domain |
| `packages/infrastructure` | Prisma persistence, seeding, external integrations — implements application/domain ports |
| `apps/api` | Nest.js host, controllers, request boundary — the only thing that talks to the database |
| `apps/web` | Next.js client — **HTTP only**, may import `@collega/design-system` and nothing else from the workspace |
| `packages/design-system` | Comp P tokens and primitives, on Tailwind v4 + shadcn/ui |

Business rules live in domain and application — **never** in controllers or React components.

`biome.json`'s `noRestrictedImports` overrides fail the build on a cross-layer import, and
`tools/boundaries` is an architecture test over those rules. `tools/arch` holds the assertions lint
cannot express, including the identity chokepoint (only the auth folder reads a credential).

## Repository layout

| Path | What |
|---|---|
| `apps/`, `packages/` | The application |
| `SPEC/` | Canonical specs — the source of truth |
| `SPEC/mockups/` | Comp P/Q HTML mockups; `comp-q-*.html` is the reference rendering |
| `e2e/` | Playwright suite (TypeScript), adapted to comp P in F2 |
| `tools/golden` | Capture/replay harness — **the conversion's only oracle** |
| `tools/boundaries`, `tools/arch` | Architecture tests |
| `src/`, `tests/`, `Collega.sln` | **Frozen .NET application.** Deleted in slice F6 |

## Source of Truth

`SPEC/*.md` is canonical. Read the relevant spec before describing or changing behavior.
`SPEC/README.MD` indexes the full set.

- `SPEC/decisions.md` — dated log of decisions that constrain later work, newest first. Read the
  top few before planning anything.
- `SPEC/50-typescript-migration.md` — the conversion plan: waves, slices, and what is settled.
- `SPEC/implementation-agent-tracker.md` — authoritative log of what is built, in progress, next.
- `SPEC/30-Contracts.md` — canonical route/payload contracts. **Read, not edited**, by every API
  slice; it is what the golden corpus pins.
- `SPEC/40-test-strategy.md` — what must be covered. `SPEC/90-definition-of-done.md` — what done means.
- `SPEC/Bug Triage.md` — clear its TODO items before new features unless the user approves an exception.

`SPEC/Specs Overview.md` is derived and non-canonical; where it disagrees, the canonical spec wins.
`SPEC/archive/` is superseded — don't read unless asked for history. `SPEC/SPECKIT/specs/` holds
downstream copies; edit the canonical file first.

## Ground-Truth Verification

Before any status, planning, or scope claim, re-read `SPEC/implementation-agent-tracker.md`'s
Current Status section AND run `git log --oneline -10` fresh in the same turn. Never answer from
recollection — this project moves fast via parallel worktree agents.

## Client Design Direction

**Comp P**, locked 2026-08-31 and made canonical 2026-09-03 (`SPEC/decisions.md`). Structure is
locked; palette is open. Built on Tailwind v4 + shadcn/ui used as intended — comp Q
(`SPEC/mockups/comp-q-*.html`) is the reference rendering, and `SPEC/mockups/_build/build_q.py`
carries the component map. The theme lives in `apps/web/app/globals.css`, carried over from
`_build/q.css`; change the palette in both or the comps stop being a reference.

If a page or flow's layout isn't settled, produce a throwaway HTML comp in `SPEC/mockups/` for
review before writing production React against an undecided design.

## Conventions

- **Errors:** the shared error model from `packages/*/src/common` (S0.3). Don't hand-build error
  responses in controllers.
- **Identity:** one chokepoint. Only the auth folder reads a credential — asserted by
  `tools/arch/identity-chokepoint.test.ts`, not just linted.
- **Request context:** `AsyncLocalStorage`, because Nest runs serverless and there is no
  long-lived in-process state to hang anything on.
- **Tests:** hermetic — no network, no real clock, no randomness. Inject the clock and fixed seeds.
  An agent does not write tests for its own code; a QA agent does.
- **SQL:** UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.
- Do not add dependencies without approval.

## The frozen .NET stack

`src/Collega.*`, `tests/`, `Collega.sln` and `global.json` are the .NET 8 / ASP.NET Core / Blazor
WebAssembly / EF Core application being replaced (`SPEC/decisions.md` 2026-09-06).

**Their instructions are no longer applicable.** Do not fix bugs, add features, write tests, add
migrations, or refactor there. A defect found in .NET is recorded against the TypeScript port. Every
`CLAUDE.md` under `src/` and `tests/` carries a banner saying so.

They stay on disk until slice **F6** for exactly two reasons:

1. **Re-recording a golden fixture** needs the .NET API to boot. The corpus is the conversion's only
   oracle, and Waves D/E are where a gap in it surfaces.
2. It is the **only runnable full application** until Waves D and E land — the reference for how a
   screen actually behaved. `README.md` and `demo.md` document how to start it for that purpose.

## Branching

- Feature branches: `feature/<NNN>-<short-description>`
- Flow: feature branch → `dev` → `main`. Report the merge commit hash.
- Each implementer works in its own worktree; the Code Reviewer gates every branch before merge.
- Once merged into `dev`, delete both the worktree and the branch.

## Explicitly Deferred

Do not build without an explicit ask: OAuth/SSO, SAML, reporting, guaranteed outbound email
delivery, remember-this-device. Per-organization AI credentials are deliberately unimplemented
(tracker rule 30); the conversion does not change that.
