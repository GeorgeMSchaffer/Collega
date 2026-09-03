# TypeScript Stack Migration — Costed, Sequenced Plan

Status: **plan, not authorization to build.** Written 2026-08-31.
Supersedes nothing; constrains the conversion effort when it is authorized.

Converts Collega from .NET 8 / Blazor WASM / EF Core to Next.js + Nest.js + Prisma +
Postgres on Vercel, per the stack recorded in `CLAUDE.md`.

**Provenance.** This document assembles the `wayfinder` map charted 2026-08-30 —
its twelve tickets, its settled constraints, and its measured baseline. It is the
artifact ticket `12` exists to produce. The map now lives beside this file at
`SPEC/typescript-conversion-map/` (ported from `feature/068-typescript-conversion-map`
on 2026-09-03); its `README.md` says which tickets this plan answers and names one
unresolved conflict on ticket `01`.

---

## 1. What is settled

Nine constraints were settled with the user during charting (2026-08-30) and three more
on 2026-08-31. Do not re-litigate these; re-open them explicitly if you must.

| # | Constraint | Detail |
|---|---|---|
| 1 | **Destination is a plan** | Charting produced this document. The build is a separate authorization. |
| 2 | **Motive: hiring + ecosystem** | Not Blazor frustration. The *whole* stack moves, server included. The cheap client-only option was ruled out. |
| 3 | **Starts after Sprint 8** | MVP ships on .NET first. Sprint 7.5 then Sprint 8 run to completion untouched. **One exception — see Wave A.** |
| 4 | **Estimated in agent-slices** | Worktree-sized units on the existing multi-agent workflow, not developer-weeks. |
| 5 | **Vitest + Playwright** | Not Cypress. The existing `e2e/` TypeScript Playwright suite is an asset and is kept. |
| 6 | **Big-bang cutover** | Not a strangler. No shippable intermediate; one cutover. |
| 7 | **Prisma introspect, then reshape** | `prisma db pull` from the live schema as a starting point, then deliberate changes. Not straight adoption, not greenfield. |
| 8 | **Turborepo + pnpm workspaces** | `packages/{domain,application,infrastructure}` + `apps/{api,web}`, mirroring current project boundaries. Enforced by `eslint-plugin-boundaries` in the same lint run as everything else. |
| 9 | **UI is comp P, on Tailwind + shadcn/ui** | Locked to **comp P** on 2026-08-31 and made canonical 2026-09-03 (`SPEC/decisions.md`). Structure locked, palette open. Built on **Tailwind CSS v4 + shadcn/ui**, used as intended; comp Q (`comp-q-*.html`) is the reference rendering and `build_q.py` carries the component map. |
| 10 | **Golden contract tests** | Ticket `04`. Record all 81 endpoints against live .NET, replay against Nest. |
| 11 | **HTTP-only Next ↔ Nest** | Ticket `09`. No direct `packages/application` imports from Next. |
| 12 | **Everything ports; View As isolated** | Ticket `03`. Nothing deferred; impersonation gets its own slice. |

### The standing risk, restated

Constraints 6 and 7 compound. Big-bang removes the shippable intermediate; reshaping the
schema removes "same data, same answers" as a correctness check; and the 16,900-line test
suite does not survive the port. That is a ~60,000-line rewrite with its oracle removed.
The user was shown this and chose both deliberately. **Constraint 10 is what replaces
those safety nets** — it is not optional garnish, and Wave A exists solely to buy it
before the .NET API is gone.

Prior evidence this is not theoretical: Sprint 5's four Postgres defects were invisible
to 561 green tests, because the InMemory provider saw neither collation, SQL translation,
nor DDL. A full rewrite has a much larger version of that blind spot.

---

## 2. Measured baseline

Counted from the working tree on `feature/066-delivery-comps-and-spec` on **2026-08-31**,
not read from a tracker. Both tracker lineages were wrong about client size when the map
was charted; this table is measured for the same reason.

| Project | Lines | Units |
|---|---:|---|
| `Collega.Domain` | 3,191 | feature-foldered entities, enums, value objects |
| `Collega.Application` | 8,624 | **30 services** |
| `Collega.Infrastructure` | 14,401 | **20 DbSets**, EF migrations, integrations |
| `Collega.API` | 4,108 | **15 controllers**, **81 endpoints** |
| `Collega.Client` | 13,043 | 21 pages, 14 shared components (C# + Razor + scoped CSS) |
| Tests | 16,900 | |
| **Total** | **~60,300** | **to re-express** |

Already TypeScript and portable: the `e2e/` Playwright suite (9 specs).

Expected output is smaller than input: **~40–45k lines of TypeScript including tests.**
TS is terser than C#, and Prisma absorbs most of what EF Core expresses as configuration.

---

## 3. Target shape

```
collega/
├── apps/
│   ├── api/                    Nest.js — the only thing that talks to the database
│   │   └── src/<feature>/      controller + module + DTOs, one folder per feature
│   └── web/                    Next.js — talks to api over HTTP, never to packages/*
│       ├── app/<route-group>/
│       └── components/
├── packages/
│   ├── domain/src/<feature>/         entities, enums, invariants — depends on nothing
│   ├── application/src/<feature>/    use cases, authorization, validation
│   ├── infrastructure/              Prisma client, repositories, integrations
│   │   └── prisma/schema.prisma     ← single most contended file in the repo
│   └── design-system/               tokens + primitives from comp P
├── e2e/                        existing Playwright suite, kept
└── tools/golden/               capture + replay harness (Wave A)
```

Layer rules, enforced by `eslint-plugin-boundaries` rather than convention:

- `domain` imports nothing.
- `application` imports `domain` only.
- `infrastructure` implements `application`/`domain` abstractions.
- `apps/api` imports `application` + `infrastructure`.
- **`apps/web` imports `design-system` only.** It reaches the server over HTTP. A lint
  error, not a code review note, is what stops constraint 11 from eroding.

---

## 4. The collision model

This is the section that makes multi-agent execution safe, and it is the part most likely
to be skipped under time pressure. Don't.

### 4.1 The rule

> **A slice owns paths, not features. Two slices may run concurrently if and only if
> their owned path globs are disjoint.**

Feature ownership is a useful heuristic but it is not the contract — the contract is the
glob. Every slice below states its owned paths. An agent that needs to edit a path it
does not own **stops and escalates** rather than editing it; that is the whole discipline.

### 4.2 Contended artifacts, and how each is neutralized

These are the files that would otherwise be edited by every slice at once. Each is either
owned exactly once and then frozen, or generated rather than hand-edited. This table is
the difference between seven agents working and seven agents producing merge conflicts.

| Artifact | Why it collides | Resolution |
|---|---|---|
| `packages/infrastructure/prisma/schema.prisma` | One file; every entity wants in | **Owned once by S0.2, then frozen.** Later changes go through a single dedicated *schema amendment* slice — never a feature slice, never two at a time. |
| `apps/api/src/app.module.ts` | Every Nest feature module registers here | Foundation creates it importing a **generated** module barrel. Feature slices create only `apps/api/src/<feature>/<feature>.module.ts`. The barrel is regenerated by script; nobody hand-edits it. |
| `packages/*/src/index.ts` barrels | Every feature exports through them | Use **subpath exports** (`@collega/domain/ideas`) so no shared barrel file exists. If barrels are unavoidable, generate them. |
| Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | Any slice might add a dependency | Foundation owns all four. Feature slices declare dependencies **only in their own package's `package.json`**. A new root-level dependency is an escalation to the integrator. |
| `apps/web/app/layout.tsx`, global token CSS | Every page depends on it | **Owned by E0 (design system), then frozen.** E0 must merge before any E1–E6 slice starts. |
| Config / env schema | Every feature adds keys | Foundation defines a typed config module that composes **per-feature schema fragments**. Features add a fragment file; nobody edits the root schema. |
| Database seed script | Every feature seeds demo data | Split into per-feature seed modules composed by one root seeder owned by Foundation. The standard demo seed (2 orgs, 8 users, 4 boards, 44 ideas) must exist in the new stack for the same reason it exists now. |
| `SPEC/implementation-agent-tracker.md` | Every slice updates status on finish | Serialize on the **merge**, not the work. The tracker is edited at merge time by whoever merges, never inside a worktree. |

### 4.3 Why HTTP-only is load-bearing here

Ticket `09`'s answer is what makes Waves D and E parallelisable at all. With HTTP-only,
an `apps/web` agent and an `apps/api` agent have provably disjoint globs and can run
simultaneously all the way through. With direct package imports, both would be editing
`packages/application`, and every web slice would serialize behind an api slice.

The cost is paid in the contract instead: **`SPEC/30-Contracts.md` becomes the shared
artifact between the two waves.** It is already canonical for endpoints, so keep it that
way — Wave D implements it, Wave E consumes it, and neither edits it. Changes to the
contract are an escalation.

### 4.4 Review is the real bottleneck

Per `CLAUDE.md`, a Code Reviewer gates every branch before it merges to `dev` and is not
a parallel implementer. One reviewer against seven implementers queues badly.

**Recommendation: 3–5 concurrent implementers, 1 reviewer**, rather than maximum
theoretical fan-out. The waves below state maximum safe concurrency; treat it as a
ceiling set by collisions, and the reviewer as the throttle set by throughput.

---

## 5. Slices

Sized to one worktree agent session. `⇉` marks the maximum number that can run at once.

### Wave A — Golden capture ⇉ 2 · **RUNS BEFORE OR DURING SPRINT 8**

The only part of this effort that cannot wait. It runs against the **live .NET API**, so
it collides with nothing in the TypeScript tree and can start immediately, in parallel
with Sprint 7.5 / Sprint 8 feature work.

| Slice | Owns | Notes |
|---|---|---|
| **A1** Capture harness | `tools/golden/` | **Built 2026-09-03.** Drives the live .NET API and records request/response pairs across all four roles — Site Admin, Org Admin, User, Read Only — because authorization is behaviour, not decoration. Zero-dependency TypeScript on Node's own type stripping; 36 self-tests. `tools/golden/README.md`. |
| **A2** Golden corpus | `tools/golden/fixtures/` | **Not started — needs the running .NET API.** Execute the capture across **81 endpoints × 4 roles**, including error paths and validation failures. Commit the fixtures. This is the oracle; if it is thin, the whole strategy is thin. `golden scaffold` generates the full grid of cases; `golden coverage` reports the holes. |
| **A3** Replay harness | `tools/golden/replay/` | **Built 2026-09-03.** Replays the corpus against a target base URL and diffs. Written now against .NET as a self-check (it must pass against the stack it recorded), pointed at Nest in Wave F. |

The endpoint count above is not quoted, it is read: `golden inventory` parses
`src/Collega.API/Controllers/*.cs` and reports 81 across 19 controllers, and the harness's
tests fail if that stops being true. Coverage is measured against the same list, so a route
the corpus never touches shows up as a hole rather than as silence.

> **If Sprint 8 closes and Wave A has not run, the golden-test strategy is gone** and the
> conversion proceeds with no oracle. Escalate rather than quietly proceeding.

### Wave 0 — Foundation ⇉ 1 (strictly serial; blocks everything after it)

| Slice | Owns |
|---|---|
| **S0.1** Monorepo skeleton | root configs, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint + `eslint-plugin-boundaries` rules, CI task graph |
| **S0.2** Prisma introspect + reshape | `packages/infrastructure/prisma/**` — `db pull`, then the deliberate reshape; generated client; per-feature seed composition. **Freezes the schema.** |
| **S0.3** Cross-cutting kernel | `packages/{domain,application}/src/common/**`, `apps/api/src/common/**` — error model, result types, pagination, auth guard skeleton, and the `AsyncLocalStorage` request context that View As will need |

S0.3 exists so that seven feature agents do not each invent their own error shape. It is
cheap insurance against the most expensive kind of rework.

### Wave B — Domain + Application ⇉ 7

Each slice owns `packages/domain/src/<feature>/**` **and**
`packages/application/src/<feature>/**` for its features. Disjoint by construction.

| Slice | Features | Rough share of the 30 services |
|---|---|---|
| **B1** | Organizations, Users, Auth | 6–7 |
| **B2** | Boards, Statuses | 4 |
| **B3** | Ideas, Upvotes | 5 |
| **B4** | Comments, Tags, Notifications | 5 |
| **B5** | Idea types, user-defined fields, business impacts | 5 — carries `IdeaTypeFieldResolver`, the densest logic in Domain |
| **B6** | AI assist, prompt versions, usage records | 3 |
| **B7** | **View As / impersonation** | 2 — isolated per ticket `03` |

B7 is separate because impersonation is ambient identity, not a feature: it changes who
every other service thinks the caller is. Porting it inside B1 would hide that. It is
also the Site Admin's only org-content mutation path, so it is load-bearing.

### Wave C — Infrastructure ⇉ 2

Smaller than its 14,401 lines suggest — Prisma absorbs most EF configuration and all 
migrations.

| Slice | Owns |
|---|---|
| **C1** Repository adapters | `packages/infrastructure/src/repositories/**` — transaction boundaries, unit of work |
| **C2** Integrations | `packages/infrastructure/src/integrations/**` — `sharp` for portraits (this **removes the ImageSharp 3.1.x licensing constraint**), `csv-parse` for import, `@nestjs/throttler` for rate limiting, notification delivery |

C2 must preserve the product rule that survived from the .NET side: **user import is
direct, idea import goes through View As.**

### Wave D — API ⇉ 7

Mirrors the Wave B partition exactly, so the same boundaries hold and D*n* can start as
soon as B*n* merges. Each owns `apps/api/src/<feature>/**`.

D1–D7 map one-to-one onto B1–B7, covering the 15 controllers and 81 endpoints.
`SPEC/30-Contracts.md` is authoritative and is **read, not edited**, by every D slice.

### Wave E — Web ⇉ 6, after E0

| Slice | Owns | Comp P screens |
|---|---|---|
| **E0** Design system | `packages/design-system/**`, `apps/web/app/layout.tsx`, `globals.css` | **Must merge before E1–E6 start.** The shadcn/ui install: Tailwind v4, the theme (`_build/q.css` carried over as `globals.css`), and the components the registry in `build_q.py` names — Sidebar, Breadcrumb, Button, Badge, Card, Table, Input/Select/Textarea/Label/Form, Dialog, Command, Skeleton, Alert, Tabs, Toggle, Avatar, Tooltip, Resizable — plus the two mechanisms shadcn has no component for: the docked inspector column and the role/state gating attributes. |
| **E1** | `apps/web/app/(auth)/**` | Login, first-login password change |
| **E2** | `apps/web/app/(desk)/layout.tsx`, `components/nav/**` | Desk shell, sidebar, command palette |
| **E3** | `apps/web/app/(desk)/ideas/**`, `boards/**` | Ideas list, board / lanes |
| **E4** | `apps/web/app/(desk)/ideas/[id]/**`, `components/inspector/**` | Idea detail, docked inspector |
| **E5** | `apps/web/app/(desk)/admin/**` | Organizations, users, statuses, idea types, fields |
| **E6** | `apps/web/app/(desk)/delivery/**` | Roadmap, sprint board, backlog, issue, grouping |

E2 owns the desk layout file, so E3–E6 must not edit it — they render into it. This is
the one place inside Wave E where a collision is plausible; the glob makes it explicit.

**E6 carries unresolved product scope.** Outcome ↔ Issue cardinality is still the
blocking Open Question in `SPEC/20-feature-issues-and-delivery.md`. Comp P renders
multi-parent affordances, but that is a layout choice, not a decision. If single-parent
wins, E6's grouping control becomes a radio group and the outcomes chip list collapses to
one value. **Answer this before E6 starts**, not during.

### Wave F — Validation and cutover ⇉ 3, converging to 1

| Slice | Owns |
|---|---|
| **F1** Golden replay | Point A3 at Nest, diff all 81 endpoints × 4 roles, fix until clean. **This is the gate.** |
| **F2** E2E adaptation | `e2e/**` — the suite is kept in principle, but comp P is a redesign, so its selectors will not survive unchanged |
| **F3** Data migration | The transform, plus an answer to whether it is reversible |
| **F4** Cutover runbook | Sequence, rollback posture, the go/no-go checklist |
| **F5** Spec reconciliation | Ticket `11` — `SPEC/*.md` updated to describe the shipped stack, including reconciling `20-feature-client-ui.md` against comp P |

F1, F2 and F3 parallelise. F4 needs all three. F5 lands last.

---

## 6. Estimate

**~66–82 slices.** Slightly under the map's first-pass 70–90, because HTTP-only keeps
integration debugging contained and Prisma collapses much of the Infrastructure layer.

| Wave | Slices |
|---|---:|
| A — golden capture | 3 |
| 0 — foundation | 3 |
| B — domain + application | 14–18 (7 partitions, most needing 2–3 sessions) |
| C — infrastructure | 4–6 |
| D — API | 14–18 |
| E — web | 16–20 |
| F — validation + cutover | 8–10 |
| Review agents | ~1 per implementation slice |

**Tokens: ~18–33M, centred near 22M.**

Derivation, stated so it can be argued with rather than trusted:

- The only real measurement available is the comp agents run during charting: **~95
  tokens per delivered line**, with browser-verified work costing roughly **1.6×**
  inspection-only work.
- ~40–45k lines of output at that rate is ~4M — but that rate is greenfield single files.
  A rewrite re-reads the C# it replaces, debugs across package boundaries, and passes a
  review gate per slice. Realistic multiplier **2–4×**.
- Cross-check on the chosen unit: ~66–82 slices at ~200k per implementation slice is
  13–17M, plus ~5M for review agents.
- Both roads land in the same place.
- **Golden capture (constraint 10) adds ~2–3M on its own.** It was chosen with that
  known.

**Confidence: low on the multiplier, moderate on the slice count.** Deliberately not
converted to currency — that needs current per-model pricing checked rather than guessed.

**Agent-slices are a planning unit, not a promise of wall-clock time.**

### What would move this materially

| Open ticket | If answered differently |
|---|---|
| `10` test suite fate | Porting 16,900 lines of tests case-by-case is expensive; re-deriving from spec is cheaper and discards the edge cases that caught the Sprint 5 defects. Blocked on `04`, now answered, so this is takeable. |
| `01` Question C | Comp N's feature concepts and Comp H's Loop are **net-new scope on top of the rewrite**, not part of it. The map branch marked Loop, decision records, commitment strip and triage mode IN on 2026-09-01 (~10 agent-slices); that is not yet a recorded decision. Adopting any is additive. |
| `06` reshape scope | A larger schema reshape inflates C1 and F3 and weakens F1's diff. |
| `07` View As ambient identity | Drives B7 and S0.3. Flagged AFK-researchable on the map. |

---

## 7. Cutover and rollback

Big-bang was chosen deliberately, so the rollback posture has to be explicit rather than
assumed.

- **Gate:** F1 green — all 81 endpoints × 4 roles replay clean against Nest — plus F2's
  adapted Playwright suite green. No cutover before both.
- **Rollback unit is the deployment, not the code.** The .NET stack stays deployable and
  its database restorable for a stated window after cutover. Name that window in F4;
  do not leave it implied.
- **F3 must state whether the data transform is reversible.** If it is not, that is the
  real point of no return, and it should be scheduled and announced as one rather than
  discovered.

---

## 8. Not converting

- **The .NET solution itself.** It is replaced, not maintained in parallel — that is what
  big-bang means.
- **The 16,900-line C# test suite**, as C#. Its *coverage* is replaced by F1 + F2 +
  re-derived Vitest tests (ticket `10`).
- **Sprint 7.5 and Sprint 8.** They run first, untouched, on .NET.
- **The product's feature set.** The conversion re-expresses existing behaviour. New
  features are `SPEC/ideas-inbox.md`'s business.
- **Per-org AI credentials.** Already deliberately unimplemented (tracker rule 30); the
  conversion does not change that.

---

## 9. Before execution starts

1. **Reconcile the branches.** Done 2026-09-03 — the map is at
   `SPEC/typescript-conversion-map/`. The ticket `01` conflict it surfaced was
   decided the same day: comp P on Tailwind + shadcn/ui (`decisions.md`). Question C
   (net-new scope) is the one part still open, and nothing in E0–E5 waits on it.
2. **Schedule Wave A now.** It is the only piece with a deadline, and the deadline is set
   by Sprint 8's close, not by this plan.
3. **Answer the Outcome ↔ Issue cardinality question** before Wave E6.
4. **Take ticket `10`** — it was blocked on `04`, which is now answered.
5. **Reconcile `SPEC/20-feature-client-ui.md`** against the comp P lock — done
   2026-09-03.
