# 01 — Which redesign direction?

Type: prototype
Status: claimed
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
