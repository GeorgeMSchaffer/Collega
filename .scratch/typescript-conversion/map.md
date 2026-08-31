# Map: TypeScript stack conversion

Label: `wayfinder:map`
Effort slug: `typescript-conversion`
Charted: 2026-08-30 · Base: `origin/dev` @ `4403c13`

## Destination

A **costed, sequenced migration plan** — a document under `SPEC/` that prices and orders the conversion of Collega from .NET 8 / Blazor WASM / EF Core to a TypeScript stack (Next.js + Tailwind, Nest.js, Prisma, Postgres, Vitest + Playwright), estimated in agent-slices against the existing worktree workflow.

The destination is the **plan, not the conversion**. This map is done when someone could pick up the document and start Sprint 9 without another decision needing to be made first.

## Notes

**Domain:** Collega is an organization-scoped idea-tracking tool (boards → statuses → swimlanes → ideas, with upvotes, comments, tags, user-defined fields, idea types, AI-assisted drafting, and Site-Admin "View As" impersonation). Roles, most to least privileged: Site Admin → Org Admin → User → Read Only. Canonical behavior lives in `SPEC/*.md`; `SPEC/30-Contracts.md` is authoritative for endpoints.

**Skills every session should consult:** `grilling` and `domain-modeling` by default. `research` for the AFK tickets. `prototype` for comp work.

### Settled during charting (2026-08-30)

These are standing constraints on the whole effort, decided with the user before any ticket existed:

| # | Decision | Detail |
|---|---|---|
| 1 | **Destination is a plan document** | Not the conversion itself. Estimate + sequence, handed off for execution. |
| 2 | **Motive: hiring + ecosystem** | Not Blazor-specific frustration — so the *whole* stack moves, server included. The cheap client-only option was explicitly ruled out. |
| 3 | **Starts after Sprint 8** | MVP ships on .NET first. Sprint 7.5 (accessibility paydown) then Sprint 8 (Azure deployment) run to completion untouched. |
| 4 | **Estimated in agent-slices** | Worktree-sized units mapped onto the existing sprint structure, not developer-weeks. |
| 5 | **Vitest + Playwright** | *Not* Cypress. Corrected by the user during charting. The existing `e2e/` TypeScript Playwright suite is an asset and is kept. |
| 6 | **Big-bang cutover** | Not a strangler. No shippable intermediate; one cutover. |
| 7 | **Prisma introspect, then reshape** | `prisma db pull` from the live schema as a starting point, then deliberate schema changes. Not a straight adoption, not greenfield. |
| 8 | **Turborepo + pnpm workspaces** | Layered packages `packages/{domain,application,infrastructure}` + `apps/{api,web}`, mirroring the current project boundaries. Enforcement via `eslint-plugin-boundaries` (same lint run as everything else, rather than a separate CI step). |
| 9 | **UI is a redesign** | Comp C "Fluent Editorial" is *unlocked* for this effort. Component library is open — evaluated by comp, not assumed. |

### Standing risk, recorded at charting time

Decisions 6 and 7 **compound**: big-bang removes the shippable intermediate, and reshaping the schema removes "same data, same answers" as a correctness check. Together they mean a ~61k-line rewrite validated against a 16.6k-line test suite that does not survive the port. The user was shown this and chose both deliberately. Ticket `04` exists solely to answer what replaces those safety nets — it is the highest-leverage ticket on this map.

### Measured baseline (verified on `origin/dev`, 2026-08-30)

What the conversion is actually carrying. Note both tracker lineages were wrong on client size; these are counted from the tree, not read from a doc.

| Project | Size |
|---|---|
| `Collega.Domain` | 3,135 lines C# · 23 entity classes |
| `Collega.Application` | 8,568 lines C# · 30 services |
| `Collega.Infrastructure` | 14,342 lines C# · 19 DbSets · 11 EF migrations |
| `Collega.API` | 4,009 lines C# · 15 controllers · **81 endpoints** |
| `Collega.Client` | 2,024 C# + 10,960 Razor + 1,397 scoped CSS · 21 pages · 14 shared components |
| Tests | 16,615 lines C# |
| **Total** | **~61,000 lines to re-express** |

Already TypeScript and portable: the `e2e/` Playwright suite (9 specs).

## Decisions so far

<!-- one line per closed ticket; the ticket holds the detail -->

_None yet — this map was charted 2026-08-30 and no ticket has been resolved._

## Not yet specified

Fog. In scope, not yet sharp enough to ticket:

- **CI/CD pipeline shape** for a Turborepo monorepo — affected task graph, caching, where Playwright runs. Waits on `02` (deployment target).
- **Data migration mechanics** — the actual transform, and whether it is reversible. Waits on `06` (reshape scope).
- **Cost model for the estimate** — how an agent-slice converts to money or calendar time, and what confidence interval to attach. Waits on enough tickets closing to know the slice count.
- **Fate of `e2e/` specifically** — the suite is kept in principle (decision 5), but whether its selectors survive a redesigned UI depends on `01`.
- **Observability and error handling** conventions in Nest vs what the .NET API does today.
- **Seed/demo data story** — the current standard demo seed (2 orgs, 8 users, 4 boards, 44 ideas) has to exist in the new stack for the same reason it exists now.

## Out of scope

Ruled beyond the destination. These do not graduate.

- **Executing the conversion.** The destination is the plan; the build is a downstream effort.
- **Sprint 7.5 and Sprint 8 themselves.** They run first, untouched, on .NET (decision 3).
- **Changing the product's feature set.** The conversion re-expresses existing behavior; new features are `SPEC/ideas-inbox.md`'s business.
- **Per-org AI credentials.** Already deliberately unimplemented (tracker rule 30); the conversion does not change that.
