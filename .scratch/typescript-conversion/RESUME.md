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

## In flight when this session ended (2026-08-30, ~20:50)

**Comp J was rejected and is being replaced.** User feedback: *"I don't think a dark theme is appropriate for a business user type application."* Comp J was dark-first, so it is retired rather than restyled.

Its replacement is **Comp N "Decision Desk"** at `SPEC/mockups/comp-n-decision-desk.html` — light-only, and carrying six novel *product* concepts rather than only a new look:

1. **Triage Mode** — focused one-idea-at-a-time review queue with decisive actions and a remaining-count
2. **Duplicate clustering** — near-identical ideas grouped with a merge affordance
3. **Vote budget** — finite votes per quarter, so upvotes carry signal
4. **Decision records** — declining or planning requires a rationale that stays visible forever
5. **Momentum** — upvote velocity sparkline, so fast-rising new ideas can outrank stale high totals
6. **Commitment strip** — a roadmap band tying the board to what the org actually committed to

**If `comp-n-decision-desk.html` is missing, empty, or obviously truncated**, the build did not finish — rerun it. The full brief is recoverable from this list plus the shared seed data in any of the other three comps.

**If it is present and complete**, then these three follow-ups were not done and still need doing:
- [ ] Delete `SPEC/mockups/comp-j-command-deck.html`
- [ ] Update the comps section of `SPEC/mockups/README.md` — replace J with N
- [ ] Update ticket `01`'s option list — replace J with N, and note that the "who is the primary user?" question now has a fourth answer shape, since N argues the primary job is *deciding* rather than browsing

The three surviving comps (K, L, M) are complete and committed.
