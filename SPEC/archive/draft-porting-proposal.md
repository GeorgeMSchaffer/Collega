# DRAFT: TypeScript / Next.js / NestJS Porting Proposal

## ⛔ Status — DO NOT IMPLEMENT

**This document is a draft proposal for evaluation only. It has not been approved, and no part of it may be implemented.**

- The canonical stack remains **ASP.NET Core + Blazor + EF Core + SQL Server 2022**, as defined in `SPEC/00-project-brief.md`. That document is unchanged and remains authoritative.
- Nothing in this file supersedes any canonical spec. Where this document and a canonical spec disagree, **the canonical spec wins** — this file is the one that is wrong.
- No implementation work, scaffolding, package installation, branch, or worktree should be created against this proposal. Continue executing the .NET plan in `SPEC/archive/70-delivery-backlog.md` and `SPEC/archive/85-implementation-timeline.md` until and unless this proposal is explicitly approved.
- Approval requires an explicit decision recorded in `SPEC/60-spec-q-and-a-backlog.md`. Until that entry exists, treat this document as speculative.
- Several decisions inside remain open (see **Open Decisions**). The proposal is not executable even if approved in principle.

## Purpose

`SPEC/archive/85-implementation-timeline.md` sizes the MVP at 40–57 agent-days on the current .NET stack. This document answers a different question: **what would it cost to move Collega to TypeScript — Next.js on the frontend, NestJS on the backend, TypeORM for persistence — and is now the moment to do it?**

It reuses that document's estimating unit exactly, so the numbers are directly comparable.

## Estimation Basis

- **Unit:** 1 agent-day = one focused Claude Code session taking a coherent task slice from empty/partial to build-clean, tested, and spec-aligned. Identical to `SPEC/archive/85-implementation-timeline.md`.
- **Excluded:** human review/approval latency, cloud/CI setup, and clarification rounds on decisions still open below.
- **Assumption:** a single agent executing sequentially, consistent with the "Sequencing for a Solo Agent" section of the timeline document.

## Measured Baseline (as of 2026-08-07)

The port is cheap primarily because very little exists to port. Measured, not estimated:

| Area | State on disk |
|---|---|
| Hand-written C# | **2,532 lines** across 47 files (`src/`, excluding `bin`/`obj`/migrations) |
| Generated EF migration + snapshot code | 718 lines — regenerated from scratch, never ported |
| Epic progress | Epic 1 (T001–T004) and Epic 2 auth (T005–T011) merged. **2 of 8 MVP epics.** |
| `src/Collega.Client` | Still the stock Blazor template — `Pages/Counter.razor`, `Pages/Weather.razor`, `wwwroot/sample-data/weather.json`. **Zero production UI written.** Client Agent (T040–T045) is paused pending comp sign-off. |
| Test projects | Only `tests/Collega.API.Tests` has content (169 lines). The Application, Domain, and Infrastructure test projects are empty. |
| Production data | None. No deployed environment, no users, no data migration burden. Migrations are throwaway. |
| API surface | 53 endpoints defined in `SPEC/30-Contracts.md` — **stack-neutral, ports untouched.** |

## Target Stack

| Concern | Current | Proposed |
|---|---|---|
| API host | ASP.NET Core Web API | **NestJS** |
| Client | Blazor WASM + Fluent UI Blazor | **Next.js (App Router)** + component library *(open — see below)* |
| ORM | EF Core | **TypeORM** *(decided 2026-08-07)* |
| Database | SQL Server 2022 | **SQL Server 2022 — unchanged** |
| Tests | xUnit | Jest + Supertest; Playwright for browser |
| Repo shape | `Collega.sln`, 5 projects | Monorepo (Nx or Turborepo), same 5 logical boundaries |

**TypeORM keeps SQL Server.** This is the main consequence of the ORM decision: TypeORM's `mssql` driver is first-class, so `docker-compose.yml`, the `MSSQL_SA_PASSWORD` / `.env` workflow, and `SPEC/50-kubernetes-deployment.md`'s database provisioning all survive unchanged. A Prisma-based port would likely have forced a move to Postgres and dragged those documents along with it.

## Layer Mapping

The architecture rules in `SPEC/00-project-brief.md` ("Domain depends on nothing", "business rules never in controllers or UI") transfer intact — NestJS's DI container, providers, guards, and pipes model the same boundaries.

| Current project | Becomes | Notes |
|---|---|---|
| `Collega.Domain` | `packages/domain` | Plain TS classes + enums. No framework dependency, preserving the "depends on nothing" rule. Near-mechanical translation. |
| `Collega.Application` | `packages/application` | Interfaces in `Abstractions/` become TS interfaces + Nest DI tokens. `AuthService` logic ports close to 1:1. |
| `Collega.Infrastructure` | `packages/infrastructure` | TypeORM entities + `DataSource`; EF repositories → TypeORM repositories. |
| `Collega.API` | `apps/api` | Nest controllers, guards, pipes, filters. |
| `Collega.Client` | `apps/web` | Next.js. Nothing to port — current content is template scaffolding. |
| `tests/*` | co-located `*.spec.ts` + `apps/api/test` | Jest replaces xUnit; Supertest replaces `Microsoft.AspNetCore.Mvc.Testing`. |

## Component-Level Port Notes

Most of the codebase is mechanical. These are the parts that are not:

### 1. The custom validation layer — the fiddliest piece
`src/Collega.API/Validation/` (181 lines, 8 files) exists specifically to produce the exact wording mandated by `SPEC/30-Contracts.md` "Validation Message Conventions" and decision 15 in `SPEC/60-spec-q-and-a-backlog.md`: spaced Title Case display names in message text ("First Name is required.") with **camelCase** keys in the `errors` object.

Porting this means:
- `ValidationMessages` → a TS module of the same template functions (trivial).
- `RequiredField`/`MaxLengthField`/`MinLengthField`/`RangeField`/`EmailFormat`/`AllowedValues` → `class-validator` decorators with custom `message` factories.
- `SpacedDisplayNameMetadataProvider` → a custom `ValidationPipe` deriving spaced Title Case from the property name.
- The `InvalidModelStateResponseFactory` camelCase path translation (`Assignees[0].UserId` → `assignees[0].userId`) → a custom exception filter. **This is easier in TS**, since the DTO properties are already camelCase and no translation step is needed at all.

### 2. Problem-details / RFC 7807
`AddCollegaProblemDetails()` wires `AddProblemDetails()` + `UseExceptionHandler()` + `UseStatusCodePages()` so *every* non-2xx (401/403/404/500) renders as `application/problem+json`. Nest has no built-in equivalent — this becomes a hand-written global `ExceptionFilter` plus a catch-all route handler. Straightforward, but it is genuinely new code rather than a translation, and the T003 verification (unknown route returns populated problem-details 404) must be re-proven.

### 3. Auth: JWT and `SecurityStamp`
`JwtAccessTokenService` is a **hand-built HS256 implementation using BCL primitives only**, to honor the no-new-packages rule. In Node this is replaced by `jose` or `@nestjs/jwt` — *less* code, not more. The `SecurityStamp` invalidation design (decision 14) is stack-independent and ports as-is: the stamp claim comparison moves into a Nest `AuthGuard`/passport-jwt strategy, replacing `BearerTokenAuthenticationHandler`.

`Pbkdf2PasswordHasher` uses `Rfc2898DeriveBytes` → Node's `crypto.pbkdf2`. Same algorithm, same iteration count, same stored format. **Existing seeded hashes stay valid** if parameters are matched exactly.

### 4. Persistence and migrations
`UserConfiguration`/`OrganizationConfiguration`/`AuditEventConfiguration` use explicit snake_case column mapping, string enum conversion, named indexes (`ux_users_normalized_email`), and a deliberately navigation-less FK for the nullable Site Admin `OrganizationId`. TypeORM expresses all of this: `@Column({ name: 'first_name' })`, `@Column({ type: 'varchar', enum: Role })`, `@Index('ux_users_normalized_email', { unique: true })`, and a plain FK column without a relation property.

`IUnitOfWork`/`EfUnitOfWork` map onto TypeORM's `QueryRunner` transactions. `typeorm migration:generate` mirrors `dotnet ef migrations add` closely enough that the T002 workflow decision carries over — including the reason `CollegaDbContextFactory` exists (design-time config resolution), which TypeORM handles via an exported `DataSource` in a standalone config file.

**Existing migrations are discarded, not converted.** With no production data this is a non-event: regenerate `InitialCreate` + `AddAuthEntities` as one clean TypeORM migration against the same schema.

**Bonus:** TypeORM's built-in soft delete (`@DeleteDateColumn`, `softRemove`, `withDeleted`) directly serves T020 (status soft-delete with reference guard) and T025 (idea soft delete + exclusion from normal queries), which currently need hand-rolled EF query filters.

### 5. Seeding
`StartupSeeder` (Site Admin from `SiteAdmin__Email`/`SiteAdmin__Password`, fail-fast on missing config, plus the 3-org dev seed) becomes a Nest lifecycle hook (`OnApplicationBootstrap`). Config keys change shape from ASP.NET's `__` convention to standard env vars — a small edit to `SPEC/20-feature-auth.md` and `SPEC/50-kubernetes-deployment.md`. Idempotency requirements (T046–T052) are unchanged.

## Estimate: Port of Existing Work

| Work | Est. (agent-days) |
|---|---|
| Monorepo scaffold (Nx/Turborepo, Next app, Nest app, TypeORM `DataSource`, wire to existing SQL Server container) | 1–1.5 |
| `Collega.Domain` → `packages/domain` (471 LOC, near-mechanical) | 0.5–1 |
| `Collega.Application` → `packages/application` (567 LOC, `AuthService` ports ~1:1) | 1 |
| `Collega.Infrastructure` → TypeORM entities, repositories, unit of work, seeder, regenerated migration | 1.5–2 |
| `Collega.API` → Nest controllers + the custom validation layer + problem-details filter | 1.5–2 |
| Auth guard / passport-jwt strategy + `SecurityStamp` invalidation | 0.5 |
| Test harness: `SmokeTests.cs` + `CollegaApiFactory` → Jest/Supertest | 0.5 |
| Spec rewrites (see "Documents Affected") | 1–1.5 |
| Integration shakeout — re-prove the T003/T005–T011 verifications end to end | 0.5–1 |

### **Port subtotal: 8–11 agent-days** (midpoint ≈ 9.5)

At the timeline document's own anchor of roughly one agent-day of net progress per weekday, that is **~2 weeks of elapsed calendar time**.

## Effect on the Remaining MVP (Epics 3–8)

Roughly 34–48 agent-days remain on the .NET plan. On the proposed stack:

| Epic | .NET est. | Delta | Rationale |
|---|---|---|---|
| 3. Organizations and Users | 5–7 | ~0 | Nest maps cleanly onto the layered design. CSV atomic import uses `QueryRunner` transactions — equivalent to EF. |
| 4. Boards and Statuses | 4–6 | **−0.5** | TypeORM built-in soft delete removes hand-rolled query-filter work for T020. |
| 5. Ideas and Engagement | 8–11 | ~0 | Many-to-many `IdeaAssignee` is comparable work in either ORM. Soft delete (T025) sees the same small win; offset by TypeORM's weaker result typing on complex board projections. |
| 6. Notification Events and Audit | 2–3 | ~0 | Persistence-only; no delivery in MVP. |
| 7. Client Experience | 10–14 | **−2 to −4** | The largest single win — see below. |
| 8. Hardening and Release | 5–7 | ~0 | Playwright browser tests are identical either way; Jest↔xUnit is a wash. |

**Epic 7 is where the stack actually pays.** `SPEC/archive/85-implementation-timeline.md` flags the Kanban rebuild (`BE-3`/`BE-4`) as *"the single largest concentration of client complexity … the most likely epic to overrun its range."* Drag-and-drop with rollback, column reorder, optimistic upvote and status updates, and multi-select assignee/tag pickers are precisely what the React ecosystem has mature, well-trodden answers for (`dnd-kit`, TanStack Query optimistic mutations). Blazor requires JS interop for drag-and-drop and hand-rolled optimistic state.

**Net: the remaining MVP is roughly a wash, tilting mildly favorable.** The port therefore costs close to its face value of 8–11 agent-days rather than being amortized away — but also is not compounded by ongoing drag.

## What Survives, What Does Not

**Survives untouched:**
- `SPEC/30-Contracts.md` (990 lines, 53 endpoints) — stack-neutral. **This is the single biggest reason the port is ~10 agent-days and not ~40.**
- All feature specs (`SPEC/20-feature-*.md`) as *behavior* definitions.
- The locked UI direction. `SPEC/mockups/comp-c-review-06-lockin-v5-final.html` is raw HTML/CSS, so the lock-in — 64px icon rail, flat swimlane cards, minimal border radius, status-colored board rows, and the Idea Detail slide-in drawer + create modal (2026-08-10, superseding the earlier full-page detail) — ports to React **more** directly than it would have to Blazor. The design decisions are not at risk.
- `docker-compose.yml`, the SQL Server 2022 container, and the `.env` workflow.
- The database schema itself, and the seeded password hashes (given matched PBKDF2 parameters).

**Does not survive:**
- **Fluent UI Blazor.** There is no drop-in equivalent; a component-library decision is required (see Open Decisions). This is a swap of primitives, not of design.
- **The "no new packages without approval" rule as currently written.** `SPEC/00-project-brief.md` Dependency Policy and `CLAUDE.md` both forbid unapproved packages, and the Auth Agent honored this by hand-writing HS256 JWT and PBKDF2 with BCL only. That discipline is not viable in Node — NestJS, TypeORM, `class-validator`, `jose`, and `dnd-kit` are all non-negotiable. The policy needs rewording (e.g. an approved baseline set plus approval for additions) rather than deletion. **This is a policy change, not an effort line.**
- The four EF migration/snapshot files and the `Collega.sln`/`global.json` toolchain pinning.

## Documents Affected

Requires rewriting (stack-specific content):
- `CLAUDE.md` — Target Architecture, Build and Run, Testing Conventions, Coding Standards, Local SQL Server sections
- `SPEC/00-project-brief.md` — Technology Stack, Solution Structure, Dependency Policy, Coding Standards
- `SPEC/50-technical-implementation-plan.md` — Architecture Plan and layer responsibilities (888 lines, the largest single edit)
- `SPEC/40-test-strategy.md` — xUnit/EF-InMemory conventions → Jest/Supertest; test *cases* themselves are unaffected
- `SPEC/20-feature-client-ui.md` and `SPEC/20-feature-client-ui-revisions.md` — Fluent UI Blazor component references
- `SPEC/archive/70-delivery-backlog.md`, `SPEC/archive/80-workstream-roadmap.md`, `SPEC/archive/85-implementation-timeline.md` — task phrasing and estimates
- `SPEC/20-feature-auth.md`, `SPEC/50-kubernetes-deployment.md` — `SiteAdmin__Email`/`SiteAdmin__Password` config-key shape

Largely unaffected: `SPEC/30-Contracts.md`, `SPEC/10-requirements.md`, the remaining `SPEC/20-feature-*.md` behavior specs, `SPEC/90-definition-of-done.md`, `SPEC/mockups/`.

## Open Decisions

**None of these are resolved. The proposal is not executable until they are.**

1. **Component library** — the significant one. Candidates: shadcn/ui + Tailwind (matches the existing `frontend-developer` agent definition and the editorial aesthetic of Comp C), Mantine, or a Fluent UI React port (closest to the original stack intent, but arguably re-imports the constraint the port would be escaping). Materially affects the Epic 7 estimate.
2. **Monorepo tool** — Nx vs. Turborepo. Low impact; Nx has stronger NestJS integration, Turborepo is lighter.
3. **Next.js data strategy** — treat the Next app as an SPA-style client against the Nest API, or use Server Components/route handlers as a BFF. The latter risks contradicting the "business rules never in UI components" architecture rule and should be constrained explicitly if adopted.
4. **Auth token transport** — the current design is a Bearer token from `JwtAccessTokenService`. Next.js makes httpOnly cookies natural; changing this would alter `SPEC/30-Contracts.md`, which is otherwise stack-neutral. **Recommendation: keep Bearer, preserve the contract.**
5. **Revised dependency policy wording** — see "Does not survive" above.

## Risks

- **The 8–11 day estimate assumes the port happens now.** It is a function of how little is built. Every merged epic raises it. At MVP-complete the equivalent figure is 40–57 agent-days — the full build cost.
- **The validation layer is the most likely line to overrun.** It exists to satisfy exact contract wording and a specific user decision (15); "close enough" is a spec violation, and the T004 verification must be genuinely re-proven, not assumed.
- **TypeORM trade-offs versus EF Core:** weaker type inference on complex query results (relevant to Epic 5's board-card projections), a slower maintenance cadence, and a hard requirement to keep `synchronize: false` so migrations stay authoritative.
- **Loss of a working, verified auth slice.** T005–T011 was verified end to end (login → forced change → `SecurityStamp` invalidation → lockout → temp password). That verification is discarded and must be redone. The 0.5–1 day shakeout line covers re-proving it, not re-designing it.
- **Spec drift during the port.** Seven-plus documents change at once. If the port and spec edits are not landed in the same slice, the "specs are the source of truth" rule breaks down mid-flight.

## Timing Argument (the actual case for considering this)

Two of eight epics are done. The client is still template scaffolding. There are no users and no data. The 53-endpoint contract — the most expensive artifact in the repo — is stack-neutral and survives.

That places the decision point at a natural seam: **Tenant Administration (T012–T019) has not started, and the Client Agent is already paused pending comp sign-off.** The cost is ~8–11 agent-days against ~34–48 remaining. The same port after MVP is the full 40–57.

If this is ever going to be seriously considered, it is cheapest now and gets monotonically more expensive from here. **That is an argument about timing, not a recommendation to proceed** — see the Status banner. The decision belongs to the user and must be recorded in `SPEC/60-spec-q-and-a-backlog.md` before any work begins.

## Appendix A — Component Library Comparison (Open Decision 1)

*Added 2026-08-07. Still a draft recommendation; not approved.*

### The governing constraint

`SPEC/mockups/comp-c-review-06-lockin-v5-final.html` was measured before writing this section. It has **zero external dependencies** — no CDN link, no Tailwind, no Bootstrap, no component framework. It is 632 lines of hand-written CSS built on a custom-property token system:

```
--ink / --ink-2 / --ink-3      --bg / --surface / --line
--accent / --accent-deep / --accent-soft
--ok / --warn / --err          --radius-btn / --radius-card / --shadow
--im-high-deep / --im-high-soft / --im-med-* / --im-low-*   (Business Impact)
--lc-deep                                                    (lane colors)
```

**The locked design is therefore already a design system, expressed in CSS variables, owned by this repo.** It does not need a component library's visual language — it needs a library's *behavior*: accessible popovers, comboboxes, focus traps, dialogs.

This inverts the usual selection criteria. A batteries-included library with strong visual defaults is a **liability** here, because every default it ships is one more thing to override to preserve a design that took multiple review rounds to lock. The critique tracker (`comp-c-review-06-critique-tracker.md`) records how deliberate that lock was.

### Required primitive inventory

Drawn from the locked comps and `SPEC/20-feature-client-ui.md`:

| # | Primitive | Source | Difficulty |
|---|---|---|---|
| 1 | Click-open popover (rail avatar → Sign Out/Profile) | Locked, v5 | Easy |
| 2 | **Searchable multi-select, inline create, max 10** (Tags) | `20-feature-client-ui.md` | **Hardest** |
| 3 | **Searchable multi-select, max 5, inactive-user display** (Assignees) | `20-feature-client-ui.md` | **Hardest** |
| 4 | Data table + sort + uniform search/pagination | Comp `-02`, `BE-4` | Medium |
| 5 | Dialog / confirm (Delete Idea, last-status guard) | Comps `-04`, `-05` | Easy |
| 6 | Toast (optimistic rollback on drag failure) | `20-feature-client-ui.md` | Easy |
| 7 | **Drag-and-drop: card between lanes + column reorder** | `BE-3`/`BE-4` | **Hard — no library covers this** |
| 8 | Tabs / pivot + List↔Swim Lane toggle | Locked, v5 | Easy |
| 9 | Color swatch picker + custom hex (`Status.Color`) | Comp `-05` | Medium |
| 10 | Date picker (optional due date) | `20-feature-client-ui.md` | Easy |
| 11 | Avatar/persona, initials, `+N` overflow | `20-feature-client-ui.md` | Easy |
| 12 | Chips/badges (priority, Business Impact, tags, status) | Locked, v5 | Easy — already in comp CSS |
| 13 | Breadcrumbs | Locked, v5 | Easy |
| 14 | File upload (CSV import) | Comp `-02` | Easy |
| 15 | Character counter (comment composer) | `20-feature-client-ui.md` | Easy |

**Item 7 is not solved by any component library** — drag-and-drop is a separate dependency (`dnd-kit`) regardless of which option is chosen, so it does not discriminate between them. Items 2 and 3 are the real differentiator.

### The candidates

**A. shadcn/ui + Tailwind (Radix primitives)**
- Not a dependency — component source is copied into the repo and owned outright. Restyling to Comp C tokens means editing your own files, never fighting a vendor theme.
- Radix supplies unstyled, accessible primitives for #1, #5, #6, #8, #10, #11, #13, #14. The comps' CSS custom properties map near-directly onto Tailwind v4 `@theme` tokens.
- Data table (#4) is TanStack Table pre-wired — the strongest option for `BE-4` uniform search/pagination.
- **Gap:** multi-select with inline create (#2, #3) is *not* a first-class shadcn component. It is hand-assembled from `cmdk`. Color picker (#9) is also hand-built. Cost: **~1–1.5 agent-days**.
- Already the stack named in this repo's existing `frontend-developer` agent definition.
- Risk: owning the source means no upstream bug fixes.

**B. Mantine**
- `MultiSelect` with `creatable` is **first-class** — directly solves #2 and #3, the two hardest items. Also ships `ColorPicker`/`ColorInput` with swatches (#9), `Dropzone` (#14), `Pagination` (#4), `Notifications` (#6). Highest raw coverage of the inventory by a wide margin, saving **~1–1.5 agent-days** against option A.
- CSS-variable theming since v7 maps onto the comps' tokens reasonably.
- **Risk:** strong visual opinion. The locked look — Georgia serif headings, warm `#faf9f8` canvas, indigo `#5b5fc7`, *minimal border radius throughout* — is not Mantine's default language. Achievable, but as a continuous override tax rather than a one-time build.

**C. Fluent UI React v9**
- Superficially the natural heir: `SPEC/mockups/README.md` says the comps were "shaped around Fluent UI component patterns," and the spec vocabulary (personas, command bar, pivot) maps 1:1, minimizing spec edits.
- **But this is the trap.** The comps were *inspired by* Fluent and then deliberately diverged. The locked v5 look — serif display headings, warm neutrals, indigo accent, flat minimal-radius rectangles — is the opposite of Fluent's Segoe/blue/rounded language. Adopting Fluent React means overriding the heaviest-opinion library in the set to reach a design that was explicitly locked *away* from it.
- Griffel CSS-in-JS + Next.js App Router SSR integration is genuinely fiddly.
- `TagPicker` (#2) exists but is the least mature of the three.

### Recommendation: **A — shadcn/ui + Tailwind**

The cost difference is close to a wash. Option A pays ~1–1.5 days building two multi-selects and a color picker; option B pays ~1–2 days overriding theme defaults to reach Comp C fidelity. Those roughly cancel.

The tiebreaker is **which kind of risk you prefer**, and the two are not equivalent:

- Option A's cost is **bounded and one-time** — build three widgets, done, and they are yours.
- Option B's cost is **diffuse and ongoing** — a fidelity tax paid on every screen, and the failure mode that most reliably burns days is fighting a library's visual defaults to preserve a hard-won design.

For a design locked this deliberately, bounded-one-time is the better trade. Option A also aligns with the existing `frontend-developer` agent definition, and its "own the source" model is the closest analogue to the hand-written CSS the comps already are.

**Estimate impact:** Epic 7's projected **−2 to −4 agent-day** saving holds under option A. The `dnd-kit` advantage that drives most of that saving is identical across all three candidates.

### Consequential spec edits (any option)

- `SPEC/20-feature-client-ui.md` line 121 — "Implement with Fluent UI Blazor components per `SPEC/mockups/README.md`" — must be rewritten. This is the only line in the locked UI spec that hard-codes the stack.
- `SPEC/20-feature-client-ui.md` "Component Structure" block (`Ideas.razor` → `IdeaKanbanBoard.razor` → `KanbanColumn.razor` → `IdeaCard.razor`, under `src/Collega.Client/Shared/Kanban/`) becomes the equivalent React tree.
- "DnD Technology: HTML5 drag-and-drop (desktop only)" should be restated as `dnd-kit`, which also makes the currently-deferred touch support cheap to add later.
- `SPEC/mockups/README.md` design-intent section references Fluent component language throughout.

**Unaffected:** every visual decision — palette, typography, rail, Flat card treatment, minimal radius, status-color system, and the Idea Detail slide-in drawer + create modal. The comps remain the authority; only the implementation primitives change.

### Still open regardless of this decision

The two undesigned areas from `CLAUDE.md` persist and are not resolved by choosing a library: the standalone `/ideas` page has no comp, and the mobile/narrow-viewport pass for the icon rail and Idea Detail's two-column layout is undesigned.

## If Approved — Prerequisite Gate

Before a single line is written, all of the following must be true:

1. An explicit approval decision recorded in `SPEC/60-spec-q-and-a-backlog.md`.
2. All five Open Decisions above resolved.
3. `SPEC/00-project-brief.md` and `CLAUDE.md` updated **first** — per the working rule that canonical specs change before implementation.
4. `SPEC/implementation-agent-tracker.md` updated to mark T001–T011 as superseded rather than complete.
5. A decision on whether the .NET implementation is deleted or retained on a preserved branch.
