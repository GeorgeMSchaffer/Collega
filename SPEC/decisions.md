# Decisions

A dated log of decisions that constrain later work. One entry per decision: what was
decided, when, and enough of the reason that a reader six months out does not reopen it
by accident. Newest first.

Supersession is recorded, not edited away — if a decision replaces an earlier one, both
stay, and the older one is marked.

---

## 2026-09-02 — Outcome ↔ Issue cardinality: single-parent

**Decided:** an Issue sits under **at most one** Outcome. Storage is `Idea.OutcomeId`, a
nullable FK with `ON DELETE SET NULL`. The `idea_outcomes` join table is rejected. Grouping
is a **move**: assigning a new Outcome clears the old one. This closes the one blocking
Open Question in `SPEC/20-feature-issues-and-delivery.md` and unblocks Slice 2 and E6.

**Why:** roadmap arithmetic is then honest by construction. Counts partition the delivery
set, per-outcome totals sum to it, and "done" is unambiguous — so no rollup anywhere needs
a distinct-count beside it. Under multi-parent every total on the page is a cover rather
than a partition, and the comps made that concrete: over the same 16 delivery issues, comp
N produced 18 memberships over 14 distinct issues, so its ledger reads `sum != the delivery
set`. It also smeared derived spans — a shared issue drags an outcome's bar into a quarter
its own work does not start in — which is a second, less obvious tax nobody asked for.

**What it costs:** work that genuinely serves two quarterly goals must pick one home. That
is a real loss and was accepted knowingly. **The failure mode to watch for is teams raising
duplicate Issues** so two Outcomes can each claim the work — which would reintroduce exactly
the provenance loss the phase model exists to prevent. If that appears in practice, treat it
as the signal to revisit, not as user error.

**Reversibility:** single → multi is a cheap forward migration (copy the FK into the join
table, drop the column). The reverse is lossy and needs a human to choose which grouping
survives. Choosing the cheap-to-undo direction is part of why this side won.

**Consequence — comp P is now stale in three places.** Comp P was built on comp N's
multi-parent mechanics while this question was open, and remains the locked direction for
shell, IA, navigation and copy. Its roadmap surfaces are not: the Issue inspector shows an
Outcomes chip list, the command palette reports a `2 shared` count that cannot occur, and
the roadmap carries the dashed shared-bar treatment and its `sum != the delivery set`
ledger. Those need regenerating from comp M's mechanics via `SPEC/mockups/_build/build_p.py`.
`comp-n-roadmap-multi.html` is retained only as the record of the rejected alternative.

---

## 2026-08-31 — Golden capture (Wave A) starts now, not with Sprint 9

**Decided:** Wave A of the TypeScript conversion — recording request/response pairs for all
81 endpoints across all four roles against the **live .NET API** — starts immediately and
runs alongside Sprint 7.5 and Sprint 8. It is not held until Sprint 9 opens.

**Why:** the golden corpus is the conversion's only oracle, and it can only be captured
while the .NET stack still exists. Sprint 8 retires that stack. Every other slice in the
conversion can wait for Sprint 8 to close; this one cannot, so its deadline is Sprint 8's
close rather than Sprint 9's start.

**Why it is safe to run early:** Wave A touches `tools/golden/` and nothing else. Under the
plan's collision model it owns paths no Sprint 7.5 or Sprint 8 slice owns, so it runs
concurrently with both without contention.

**Consequence:** A1 (capture harness), A2 (corpus, 81 endpoints × 4 roles, error paths
included) and A3 (replay harness) are live work now and belong on Sprint 8's calendar.
`SPEC/95-next-sprints.md` and the tracker should show them as in-flight, not queued.

---

## 2026-08-31 — Comp P is the locked UI direction; colour stays open

**Decided:** `SPEC/mockups/comp-p-focus-roadmap.html` is the locked structural direction
for the client UI. Its **layout, information architecture, and copy model are locked**.
Its **palette is explicitly not locked** and is expected to be tweaked.

**Why:** Comp P is comp D's Focus Desk carrying comp N's multi-parent roadmap, restyled on
the `DESIGN.md` token layer. It covers all ten screens (Login, Home, Ideas list, Board,
docked inspector, Roadmap, Issue, Grouping, Settings, Command palette) rather than a
fragment, so there is a whole product to lock rather than a mood.

**What "structure" means here, concretely:**

- The desk shell: fixed left sidebar with grouped nav, top bar with breadcrumb and page
  actions, a single scrolling work column.
- The **docked inspector as a third grid column**, never a modal. No focus trap, nothing
  covered, Escape closes the column.
- **Inline create beside the list it adds to**, rather than a drawer, for short forms.
  Longer edits use the docked inspector.
- Home answers *"what needs me now"*, not *"what exists"* — KPI row, attention queue,
  activity feed, all filtered queries rather than dead-end summaries.
- **Two copy voices, kept apart**: product copy inside the app frame, reviewer/comp
  commentary outside it. See below.
- The dot-plus-label marker as the single encoding for type, status, and priority.

**What is not locked:** the palette. `DESIGN.md`'s sticker colours are placeholders at
this point; comp P proves the structure survives whatever hue set replaces them, because
no colour in it carries meaning alone.

**Supersedes:** the 2026-07-30 selection of Comp A "Command Center" as the implementation
layout, recorded in `SPEC/mockups/README.md` and `SPEC/20-feature-client-ui.md`. That
selection assumed the .NET/Blazor/Fluent UI stack. Both the stack and the direction have
moved; `SPEC/20-feature-client-ui.md` should be reconciled against comp P before any UI
work starts on the new stack.

**Consequence for the TypeScript conversion:** this closes the UI half of conversion
ticket `01` (redesign direction). The component library question inside that ticket is
still open — comp P is hand-rolled CSS on tokens and does not presume a library.

---

## 2026-08-31 — Colour may never be the only carrier of meaning

**Decided:** in any Collega UI, a colour may reinforce a category but may never be the
only thing that distinguishes it. Every coloured dot, bar, or fill carries a text label
in the same component.

**Why:** it reconciles two rulebooks that looked contradictory. `DESIGN.md` forbids
colour that *structures* a layout while permitting a sticker palette for category dots;
Collega's own accessibility rule forbids colour carrying meaning *alone*. An 8px dot plus
an always-present label satisfies both, and it is the reason comp P could collapse comp
D's three separate chip families into one `.marker` component.

**Corollary — the roadmap's "shared" encoding.** Comp N distinguished shared outcomes
with a tinted bar. That is a structural fill, which `DESIGN.md` forbids, and comp O-3
demonstrated that plain neutral bars lose the outcome at a glance. Comp P encodes
"shared" in **border style — a dashed outline — rather than hue**. Border style is not
colour, so it survives greyscale, colour blindness, and print. Keep this even if the
`DESIGN.md` direction is later dropped.

---

## 2026-08-31 — Home carries two voices, kept apart

**Decided:** in the comps and in the shipped product, **product copy lives inside the app
frame** and is written to be lifted straight into the UI. **Anything addressed to a
reviewer** — screen inventories, keyboard shortcuts for navigating the comp, notes about
which screens carry open questions — lives in the comp chrome band outside the app frame.

**Why:** a reviewer should never have to guess which sentences would ship. In comp P this
means Home carries a real first-run strip, a definition under each KPI saying what it
counts, and a standfirst on each panel saying how the list is ordered — all shippable —
while the orientation text sits in the band above the frame.

---

## 2026-08-31 — TypeScript conversion: three constraints settled

Answers to open tickets on the `wayfinder` conversion map
(`.scratch/typescript-conversion/` on `feature/068-typescript-conversion-map`). Full
reasoning in `SPEC/50-typescript-migration.md`.

| Ticket | Decision | Consequence |
|---|---|---|
| `04` validation strategy | **Golden contract tests.** Record request/response pairs for all 81 endpoints against the live .NET API, replay against Nest. | **Has a calendar consequence.** The capture slices must run *before or during Sprint 8*, while the .NET API still exists. Everything else in the conversion can wait for Sprint 8 to close; this cannot. |
| `09` Next ↔ Nest boundary | **HTTP only.** `apps/web` calls `apps/api` over HTTP, the same shape as today's Blazor → API. No direct imports of `packages/application` from Next server components. | Web slices and API slices never open the same file, so they parallelise cleanly. This is the decision that makes the agent partition work. |
| `03` conversion scope | **Everything ports. View As gets its own slice.** Nothing is deferred, but impersonation is carved out of the auth work rather than riding inside it. | No reduction in first-cut scope. View As is isolated because it is the one genuinely high-risk substitution. |

**Still open on that map:** `01` (component library half), `02`, `05`, `06`, `07`, `08`,
`10`, `11`. The plan states what each would change if answered differently.

---

## 2026-09-02 — A denied admin route shows a refusal, not a disabled page

The comp P refresh plan settled that denied actions should render **disabled with a
reason** rather than hidden, which is the right rule for a control inside a page the
caller is allowed to see. It does not decide what happens when the caller is not allowed
to see the page at all, and the two cases were being read as one.

They are separate gates in the shipped client. `<AuthorizeView>` hides individual controls
inside a page; `[Authorize(Roles = …)]` on the page closes the route outright, so a `User`
never reaches `/settings/statuses` in any form.

**Decided: a denied route renders a short refusal panel** — the page title, who the route
is for, and a way back to Settings. Not the live page with every control disabled.

Disabling the page would put the organization's configuration in front of members who
cannot act on it, which is a disclosure change dressed as an accessibility one, and it
would contradict the route's own `[Authorize]` attribute. The refusal panel still honours
what the rule is actually for: the denial is *explained where the user hit it* rather than
being a silent redirect. Controls **inside** a page the caller may see — a Site Admin's
read-only view of an organization's statuses — keep `aria-disabled` plus a reason exactly
as the plan says.

Applies to all 23 `/settings/*` screens in `comp-p-admin.html`, generated by the `GUARD`
token in `SPEC/mockups/_build/build_p.py`.

---

## 2026-09-02 — Conversion slices merge to `dev`, not to an integration branch

Considered a long-lived `typescript-conversion` branch acting as `dev` for the conversion,
with feature branches merging into it and one merge to `dev` at cutover. **Rejected.**

The isolation it offers is isolation that already exists. Both deploy workflows fire on
`main` only (`deploy-client.yml` is further path-scoped to `src/Collega.Client/**`), so
nothing ships from `dev` regardless of what lands there. The conversion tree is `apps/`,
`packages/` and `tools/` — disjoint from `src/` by the plan's own layout. And there is no
root `package.json` today, so the monorepo skeleton creates the root tooling rather than
disrupting anyone's existing commands.

Three costs decided it:

- **Wave A cannot live on a conversion branch.** `tools/golden/` drives the *live .NET
  API* and its deadline is Sprint 8's close. Sequestering it means the people changing
  that API during Sprint 8 cannot run the capture as they go — and the corpus is the
  oracle the whole validation strategy rests on.
- **The shared files conflict continuously.** `implementation-agent-tracker.md`,
  `30-Contracts.md`, `decisions.md` and the comps are edited by both .NET sprint work and
  conversion work. §4.3 already requires the tracker to serialize on the merge; a
  months-long branch turns every one of them into a recurring conflict.
- **Cutover deletes the .NET solution.** That is the highest-risk change in the project.
  It should land as its own reviewed slice against a current `dev`, not inside a merge
  that has been diverging for months.

**Consequence:** `dev` carries half-built TypeScript for the duration. That is accepted —
`main` is the deploy gate, and per §7 the rollback unit is the deployment, not the code.

---

## 2026-09-02 — The board is a scrolling rail of fixed-width columns

**Decided:** board swimlanes render as **288px columns in a horizontally scrolling
rail**, each with its own ground, rather than as N equal fractions of the work column.

**Why:** a board's swimlanes are chosen per board from the organization's statuses, with
no upper bound. Dividing the available width means every status anyone adds makes every
existing column narrower — at five lanes the titles already wrapped to two lines, and the
failure is unbounded. A fixed column degrades by scrolling instead, which costs a gesture
rather than legibility. Trello and Jira both took this trade.

**Constraint that comes with it:** the *rail* scrolls, never the page. Verified at 1280px
and 1440px.

**Not a supersession.** The 2026-08-31 comp P lock enumerates what "structure" covers —
the desk shell, the docked inspector, inline create, Home's question, the two voices, the
dot-plus-label marker. Column arrangement inside the board is not in that list, so this
refines the locked direction rather than reversing part of it.

---

## Earlier decisions

Decisions made before this log existed are recorded in the documents they constrain —
chiefly `SPEC/95-next-sprints.md` (sprint sequencing and the paydown-first rule),
`SPEC/implementation-agent-tracker.md` (build state and standing rules), and the
"Settled during charting" table in the conversion map. They are not restated here; this
log starts 2026-08-31 and runs forward.
