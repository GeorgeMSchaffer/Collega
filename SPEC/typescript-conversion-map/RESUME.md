# Resume here

Written 2026-08-30, end of the charting session. Read this first, then `map.md`.

## Where you are

The wayfinder map for the TypeScript conversion is **charted**. No ticket has been resolved yet. The destination is a **costed plan document**, not the conversion itself.

Branch: `feature/068-typescript-conversion-map`, based on `origin/dev`.

```
git fetch origin && git checkout feature/068-typescript-conversion-map
```

## Do this first

Open the four comps side by side and answer `01`. It is the only ticket with artifacts already waiting, and Question A on it ("who is the primary user?") is the one answer that makes several other questions easier.

```
SPEC/mockups/comp-j-command-deck.html
SPEC/mockups/comp-k-material-workspace.html
SPEC/mockups/comp-l-canvas-board.html
SPEC/mockups/comp-m-editorial-continuum.html
```

## Then this — and don't let it slide

**Ticket `04` has a deadline the others don't.** If the validation strategy involves recording golden request/response pairs from the live .NET API, that capture has to happen **while the .NET API still exists** — before or during Sprint 8. Every other ticket on this map can wait for Sprint 8 to close. This one cannot, and it is the ticket that decides whether a ~61,000-line rewrite has any oracle at all.

## Frontier — takeable right now

| Ticket | Type | Note |
|---|---|---|
| `02` deployment target | grilling | Needs your read on what "ecosystem" meant |
| `03` what ports | grilling | Recommendation is "everything, but View As gets its own slice" |
| `04` validation strategy | grilling | **Highest leverage. Has a calendar consequence.** |
| `05` Prisma introspection | research | **AFK — can run unattended in a worktree** |
| `07` View As ambient identity | research | **AFK — can run unattended in a worktree** |
| `09` Next↔Nest boundary | grilling | ADR candidate |
| `11` spec reconciliation | grilling | |

`01` is claimed. `06` waits on `05`; `08` waits on `07`; `10` waits on `04`; `12` assembles everything.

The two research tickets are the obvious parallel work — they need no conversation, and both feed decisions that are otherwise blocked. Running them in worktrees while you think about `01` costs nothing.

## Two things I could not resolve for you

**1. Your local `dev` is diverged.** It carries 2 commits not on `origin/dev` (`3582713`, `f72ed69`) and is 17 behind. Both look like work the other machine already did independently — `163a46d` and `6399070` cover the same ground. I branched off `origin/dev` rather than merging, so nothing is lost, but the divergence is still there and reconciling it is your call.

**2. The two tracker lineages disagree**, and both are wrong about client size. Local says 760 tests / Sprint 8 next / 29 pages. Origin says 811 tests / Sprint 7.5 next / 16 pages. The tree says 21 page files and 14 shared components. **The map's baseline is measured from the tree on `origin/dev`, not read from either tracker** — keep it that way.

## Baseline (measured, not quoted)

| Project | Size |
|---|---|
| Domain | 3,135 lines · 23 entity classes |
| Application | 8,568 lines · 30 services |
| Infrastructure | 14,342 lines · 19 DbSets · 11 migrations |
| API | 4,009 lines · 15 controllers · **81 endpoints** |
| Client | 2,024 C# + 10,960 Razor + 1,397 scoped CSS |
| Tests | 16,615 lines |
| **Total** | **~61,000 lines to re-express** |

## Settled — do not re-litigate

Plan not build · motive is hiring + ecosystem so the whole stack moves · starts after Sprint 8 · estimated in agent-slices · Vitest + Playwright, not Cypress · big-bang cutover · Prisma introspect then reshape · Turborepo + pnpm with lint-enforced layer boundaries · UI is a redesign with Comp C unlocked.

Full detail and rationale in `map.md` under "Settled during charting".

---

## Comp status (settled 2026-08-30, nothing outstanding)

**Comp J was rejected and has been deleted.** User feedback: *"I don't think a dark theme is appropriate for a business user type application."* Dark-first was integral to that direction rather than a setting on it, so the comp was retired rather than restyled. It is recoverable from git history at `0e2bd39`.

**Comp N "Decision Desk"** replaced it — `SPEC/mockups/comp-n-decision-desk.html`, light only, browser-verified. Its argument is a product argument rather than a visual one: the hard problem is deciding, not displaying. It carries six new feature concepts (Triage Mode, duplicate clustering, vote budget, decision records, momentum over totals, commitment strip), all of which are **separable from its look** and are now Question C on ticket `01`.

Four comps stand: **K, L, M, N**. All indexed in `SPEC/mockups/README.md` with the buildability assessment of each of N's concepts.

## One estimate exists already

Ticket `12` carries a first-pass token estimate: **~1.5–2.5M to finish this map**, and **~15–30M to execute the conversion** if it is ever authorized. Low confidence on the multiplier, moderate on the slice count, deliberately not converted to currency. Tickets `04`, `09`, `10` and `01`-Question-C are what move it.
