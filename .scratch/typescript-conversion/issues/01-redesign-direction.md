# 01 — Which redesign direction?

Type: prototype
Status: claimed
Blocked by: —

## Question

Comp C "Fluent Editorial" is unlocked for this effort (charting decision 9). The rewrite needs a visual language and a component substrate, and the two choices are entangled — a substrate carries a look whether or not you intend it to.

Four interactive comps were built to answer this, each committing to a different design language *and* a different library, so the comparison tests both at once:

| Comp | Direction | Library |
|---|---|---|
| J — Command Deck | Dense, keyboard-first, professional-tool | Tailwind + hand-rolled primitives |
| K — Material Workspace | Material Design 3, familiar enterprise | MD3 tokens, plain CSS |
| L — Canvas Board | Spatial, warm, card-centric | Bootstrap 5 |
| M — Editorial Continuum | Comp C's language evolved forward | Tailwind |

Each renders the same content (same org, boards, statuses, ideas, users) across the same five surfaces, so differences are design, not data.

**Resolve by:** picking one direction, or one direction's shell with another's treatment of a specific surface. The answer names the winner, says what carries over from the losers, and states whether the component library follows the comp or is re-decided separately.

## Assets

- `SPEC/mockups/comp-j-command-deck.html`
- `SPEC/mockups/comp-k-material-workspace.html`
- `SPEC/mockups/comp-l-canvas-board.html`
- `SPEC/mockups/comp-m-editorial-continuum.html`

## Notes from the comp build (2026-08-30)

All four comps were built and are on disk. Three findings emerged that matter more than the comps themselves:

1. **Board density is contested by the product's own roadmap.** Comps L and M each flagged independently that a spacious board fights the seeded idea "Faster board load for 500+ ideas." Two directions converging on this unprompted suggests the board and the idea-detail surface may want *different* density treatments regardless of which direction wins — which would make the answer to this ticket a hybrid rather than a single pick.
2. **The real axis is who the primary user is.** J's density serves someone who lives in the tool all day and reads as intimidating to an org admin triaging weekly. K's Material vocabulary is the inverse trade. **Settle the user question before the look question** — otherwise this ticket resolves on taste.
3. **Carry forward to the real build:** an element with both the `hidden` attribute and a `flex`/`grid` class renders visible (the display class beats the UA `[hidden]` rule). Add `[hidden]{display:none!important}` to the Next.js base styles on day one.

Comps J and K were verified by driving them in a browser; L and M were verified by inspection and JS parse only.
