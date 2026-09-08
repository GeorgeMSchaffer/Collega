# 01 — Which redesign direction?

> **Decided 2026-09-03; this ticket is closed.** `SPEC/decisions.md` rules comp P canonical (withdrawing the Comp C answer below) and the client built on Tailwind CSS + shadcn/ui (confirming the Tailwind answer below, with shadcn/ui on top). **Question C is answered too:** Loop, decision records, commitment strip and Triage Mode are in — as **Wave G**, starting when F1 is green — and momentum, duplicate clustering and vote budget are not. Question A was never answered on its own; comp P settled it in practice. This file is kept as written.

Type: prototype
Status: closed 2026-09-03 in `SPEC/decisions.md` (comp P, Tailwind + shadcn/ui, Wave G scope)
Blocked by: —

## Question A — What is the primary job? *(answer this first)*

The comps surfaced that this, not aesthetics, is the real axis. Answering it makes the look question mostly decide itself.

### Select one

- [ ] **1 — Browsing and contributing.** People add ideas and read what others posted. The board is the product. Points at K, L or M.
- [ ] **2 — Deciding.** The bottleneck is 200 ungroomed ideas, meaningless vote counts, and no record of why anything was declined. Points at N.
- [ ] **3 — Reading and discussing at length.** Long descriptions, real comment threads. Points at M.
- [ ] **4 — Genuinely mixed**, and the UI has to serve more than one.

## Question B — Which visual direction?

### Select one

- [ ] **K — Material Workspace** (Material Design 3). Navigation rail, FAB, real MD3 color roles, elevation and state layers. Familiarity as a feature.
- [ ] **L — Canvas Board** (Bootstrap 5.3, re-themed). Warm bone/sand ground, terracotta accent, cards as physical objects, working drag-and-drop.
- [ ] **M — Editorial Continuum** (Tailwind). Comp C's typography carried forward, hierarchy from type not containers, idea detail as a magazine article.
- [ ] **N — Decision Desk** (Tailwind, light only). Calm and professional, but its real argument is the feature set in Question C.
- [ ] **Hybrid** — one direction's shell with another's treatment of a specific surface. See the density finding below; this may well be the honest answer.

## Question C — Which of Comp N's feature concepts are in scope?

N's concepts are **separable from its visual direction** — any of them could be adopted on top of K, L or M. They are also net-new product scope, so each one enlarges the conversion rather than just re-expressing it.

### Check each one you want carried into the plan

- [ ] **Triage Mode** — focused one-idea-at-a-time review queue with a remaining count and decisive actions. *Best structural idea in the set; largely a filtered, ordered view over actions that already exist.*
- [ ] **Decision records** — written rationale required on decline, stored permanently on the idea. *Strongest and cheapest. No ML, answers a real organizational pain.*
- [ ] **Commitment strip** — roadmap band tying the board to what the org actually committed to. *Also cheap, also strong.*
- [ ] **Momentum over totals** — upvote velocity sparklines and sorting. *Good idea, trivial UI, but needs a real gaming-resistant velocity algorithm. The comp fakes it.*
- [ ] **Duplicate clustering** — near-identical ideas grouped with a merge flow. *Honest demo-ware: real similarity detection is the ML problem the spec already defers.*
- [ ] **Vote budget** — finite votes per user per quarter, with a reclaim flow. *Most consequential and least free — it changes user behavior and needs policy decisions (reset timing, carryover, admin exemptions) before it is implementable.*
- [ ] **None** — take a visual direction only, and keep the conversion a like-for-like re-expression. *Recommended if you want the estimate to stay predictable.*

One refinement from the comp's own author, worth taking: require a rationale on **Decline only**, not on Plan. "Why did we reject this" is valuable; "why did we build this obviously good thing" is friction.

## Question D — Does the component library follow the comp?

### Select one

- [ ] **Yes** *(recommended)* — take the winner's library with it; the comp already proved it can carry the look.
- [ ] **No** — re-decide the library separately once the design is settled.

## Assets

- `SPEC/mockups/comp-k-material-workspace.html`
- `SPEC/mockups/comp-l-canvas-board.html`
- `SPEC/mockups/comp-m-editorial-continuum.html`
- `SPEC/mockups/comp-n-decision-desk.html`

All four render identical seed content across the same core surfaces, so differences are design, not data. Open them side by side.

**Retired:** `comp-j-command-deck.html` (Command Deck — dense, keyboard-first, dark-first) was rejected 2026-08-30 because a dark theme is not appropriate for a business application, and dark-first was integral to that direction rather than a setting on it. Recoverable from git history if the density argument is ever wanted again.

## Notes from the comp build (2026-08-30)

1. **Board density is contested by the product's own roadmap.** L and M each flagged independently that a spacious board fights the seeded idea "Faster board load for 500+ ideas." Two directions converging unprompted suggests board and detail may want *different* density treatments — which is why Hybrid is a real option in Question B, not a cop-out.
2. **N is not apples-to-apples.** K, L and M argue about presentation; N argues about the job to be done. If its concepts land, the honest outcome may be "K's look with N's features."
3. **Carry forward to the real build:** an element with both the `hidden` attribute and a `flex`/`grid` class renders visible — the display class beats the UA `[hidden]` rule. It caught two separate comps. Add `[hidden]{display:none!important}` to the Next.js base styles on day one.

Verification status: K and N were driven in a real browser and had bugs fixed. L and M were verified by inspection and JS parse only.

## Consequence for the estimate

Question C is the one that moves the number. A visual direction is re-expression work already inside the baseline. Every checked feature concept is **net-new scope on top of a rewrite**, and lands in `12` as additional slices rather than as part of the conversion.

---

## Resolution in progress (2026-09-01)

### Question B — answered off-list

**Neither K, L, M nor N. Carry Comp C "Fluent Editorial" forward into the rewrite.**

The user reached for **Comp H "Loop"** as "the best". Comp H is not a direction — it is a *feature* comp (mentions → notification inbox → activity feed) from the 2026-08-16 round, deliberately drawn in the **locked Comp C language** so only the feature was under review. Asked which half they meant, they answered **both**.

So C was unlocked for this effort and the user has re-chosen it on merit. That is a legitimate outcome of unlocking, not a failure to decide.

Consequence: **Comp M is the closest listed comp** — it is explicitly "Comp C's typographic language carried forward and freed from Fluent's component constraints." Whether the rewrite reproduces C's look *through Fluent UI React* or *rebuilds it in Tailwind à la M* is now the live fork, and it is Question D rather than Question B.

K, L and N are **not selected**. N's visual direction is out; its six feature concepts remain separately live under Question C.

### Question C — one addition, from outside the list

- [x] **Comp H's "Loop"** — @mentions, a real notification inbox, and the activity feed Home currently advertises as "coming soon". *Net-new scope on top of the rewrite, same as any N concept. Comp H's own argument is that these are one feature, not three: a notification with nothing to notify about is empty, and a feed nobody is addressed by is noise.*

N's six concepts (Triage Mode, decision records, commitment strip, momentum, duplicate clustering, vote budget) are **still unanswered**.

**Reframed 2026-09-01.** The first attempt offered bundled tiers ("the cheap three", "records and strip only", "none",
"all six"). The user asked to see the outcomes instead, and on reflection the tier cut was invented for the convenience of
asking — the concepts do not group that way, and bundling them hides that three are cheap volume while three carry risk
that no slice count captures. Replaced with `SPEC/mockups/comp-01c-scope.html`, where each concept toggles independently
and reports what it adds in entities, endpoints, surfaces and rough agent-slices.

What the comp establishes, and what should survive into `12` regardless of which concepts are chosen:

| Concept | Ent. | Endp. | Surf. | Slices | Unpriced risk |
|---|---|---|---|---|---|
| Loop (Comp H, already in scope) | 2 | 5 | 2 | 4 | — |
| Decision records | 1 | 2 | 1 | 2 | — |
| Commitment strip | 1 | 3 | 2 | 2 | — |
| Triage Mode | 0 | 1 | 1 | 2 | — |
| Momentum over totals | 1 | 1 | 0 | 3 | Needs a gaming-resistant velocity algorithm |
| Duplicate clustering | 2 | 4 | 2 | 6 | Similarity detection is the ML problem SPEC defers |
| Vote budget | 2 | 4 | 2 | 5 | Reset/carryover/exemption policy is undecided |

Loop alone is 4 slices; all seven is 24. The three risk rows are the ones whose numbers should not be trusted — each needs
a decision or an algorithm that does not exist yet.

#### Round 1 answered (2026-09-01) — the three low-risk concepts are all IN

- [x] **Decision records** — rationale required on **Decline only**, not on Plan. Permanent, visible to everyone, and it survives a later reopen.
- [x] **Commitment strip** — roadmap band above every board, plus the admin surface that sets it.
- [x] **Triage Mode** — no new entity; a filtered, ordered queue over actions that already exist.

Running total with Comp H's Loop: **4 entities · 11 endpoints · 6 surfaces · ~10 agent-slices**, none of it carrying unpriced risk.

Round 2 (momentum, duplicate clustering, vote budget — the three that do carry risk) asked separately.

One finding from building it, worth carrying: **momentum is not free even in the schema.** The current design stores vote
totals, not vote events, so "velocity" has nothing to compute over until vote history exists. That is a `06` (schema
reshape) consequence, not just a UI feature.

### Question D — answered

**Rebuild Comp C's language in Tailwind, à la Comp M.** Not Fluent UI React.

Verified before deciding, rather than assumed: Fluent UI React v9 (`@fluentui/react-components`) *does* support Next.js App Router SSR, but it requires the `fluentui-next-appdir-directive` SWC plugin over the `@griffel`/`@fluentui` paths plus `RendererProvider` + `SSRProvider` + `FluentProvider` at the root. The practical consequence is that everything under the provider becomes a client component, so React Server Components buy almost nothing — which lands directly on ticket `09`'s Next↔Nest boundary.

Three reasons this went to Tailwind:

1. **The motive argues against it.** The whole stack is moving for hiring + ecosystem reasons (settled decision 2). Carrying the React sibling of Fluent UI Blazor forward keeps the client inside the ecosystem being left.
2. **RSC stays available.** Feeds `09`.
3. **Comp M already proved it.** M *is* C's typography freed from Fluent's component constraints, so the rebuild has a worked reference rather than being speculative.

Cost accepted: the component layer is hand-built rather than inherited, and Fluent's built-in accessibility is no longer free — it becomes work the plan has to price. Headless primitives (Radix/shadcn-style) were offered as a middle path and not taken; nothing stops the build using them for behaviour, and the plan should treat that as an open implementation detail rather than a closed door.

**Sprint 7.5 is relevant here.** That sprint exists because three systemic accessibility defects — Enter submitting no form, `DrawerShell` never taking focus, `FluentTextField` having no accessible name — were invisible to a fully green suite. Two of the three are Fluent-shadow-DOM artifacts that a Tailwind rebuild simply will not inherit; the third (focus management) becomes *our* problem rather than a library's. Either way it is a finding for `12`, not a wash.

### Still open on this ticket

- **Question A** (primary job) — never answered; the user answered with a comp instead. Lower stakes now that B is settled, but it still feeds `03` and `12`.
- **Question C** — N's six concepts.
