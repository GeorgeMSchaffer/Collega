# 01 — Which redesign direction?

Type: prototype
Status: claimed
Blocked by: —

## Question A — Who is the primary user? *(answer this first)*

The comps surfaced that this is the real axis. Answering it makes the look question nearly decide itself.

### Select one

- [ ] **1 — Power users who live in the tool all day.** Density and keyboard speed win. Points at Comp J.
- [ ] **2 — Occasional org admins triaging weekly.** Familiarity and approachability win. Points at Comp K or L.
- [ ] **3 — Discussion-heavy teams who read and write at length.** Reading quality wins. Points at Comp M.
- [ ] **4 — Genuinely mixed**, and the UI has to serve all three.

## Question B — Which direction?

### Select one

- [ ] **J — Command Deck** (Tailwind, hand-rolled). Dense, keyboard-first, dark-by-default, Linear/Height idiom. Cmd+K palette, `J`/`K` navigation.
- [ ] **K — Material Workspace** (Material Design 3). Navigation rail, FAB, real MD3 color roles, elevation and state layers. Familiarity as a feature.
- [ ] **L — Canvas Board** (Bootstrap 5.3, re-themed). Warm bone/sand ground, terracotta accent, cards as physical objects, working drag-and-drop.
- [ ] **M — Editorial Continuum** (Tailwind). Comp C's typography carried forward, hierarchy from type not containers, idea detail as a magazine article.
- [ ] **Hybrid** — one direction's shell with another's treatment of a specific surface. See the density finding below; this may be the honest answer.

## Question C — Does the component library follow the comp?

### Select one

- [ ] **Yes** *(recommended)* — take the winner's library with it; the comp already proved it can carry the look.
- [ ] **No** — re-decide the library separately once the design is settled.

## Assets

- `SPEC/mockups/comp-j-command-deck.html`
- `SPEC/mockups/comp-k-material-workspace.html`
- `SPEC/mockups/comp-l-canvas-board.html`
- `SPEC/mockups/comp-m-editorial-continuum.html`

All four render identical seed content across the same five surfaces, so differences are design, not data. Open them side by side.

## Notes from the comp build (2026-08-30)

Three findings emerged that matter more than the comps themselves:

1. **Board density is contested by the product's own roadmap.** Comps L and M each flagged independently that a spacious board fights the seeded idea "Faster board load for 500+ ideas." Two directions converging on this unprompted suggests the board and the idea-detail surface may want *different* density treatments regardless of which wins — which is why "Hybrid" is a real option in Question B, not a cop-out.
2. **Settle the user question before the look question.** J's density serves someone who lives in the tool; K's Material vocabulary is the inverse trade. Answer Question A first or this resolves on taste.
3. **Carry forward to the real build:** an element with both the `hidden` attribute and a `flex`/`grid` class renders visible — the display class beats the UA `[hidden]` rule. Add `[hidden]{display:none!important}` to the Next.js base styles on day one.

Verification status: J and K were driven in a real browser and had bugs fixed. L and M were verified by inspection and JS parse only.
