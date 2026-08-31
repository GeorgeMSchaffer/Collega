# UI Feedback
This is just note document to keep feedback regarding the design of the comps

#1 ./SPEC/mockups/comp-d-focus-desk.html in general, but with the roadmap functionality layout from ./SPEC/mockups/comp-n-roadmap-multi.html

Can you create a comp that combines the two and applies the color, fonts, etc... based on the DESIGN.md rules.

---

## Answer to #1 — `comp-p-focus-roadmap.html` (2026-08-31)

Five screens: **Home** (comp D's KPI row, attention queue, activity feed), **Roadmap**,
**Issue**, **Grouping**, **Command palette**. Built on the same shared token layer as the
comp O set, with every DESIGN.md value verified in-browser: Inter loaded, `heading-1` at
40px/−1px tracking, canvas `#f6f5f4`, primary `#0075de`, pill CTAs, 12px panels, 4px inputs.

Two things worth knowing about the result:

- **The roadmap needed a new idea to work.** Comp N distinguishes outcomes with tinted
  bars. DESIGN.md forbids a structural fill from the sticker palette, and comp O-3 had
  already shown that neutral bars alone lose the outcome at a glance. Comp P encodes
  **"shared" in the border style — a dashed outline — rather than a hue.** That is not
  colour, so it survives greyscale, colour blindness and a printed page, none of which a
  tint does. The outcome itself keeps a category dot with its name always beside it. This
  is worth keeping even if the Notion direction is dropped.
- **Using comp N is a layout choice, not a decision.** Outcome ↔ Issue cardinality is
  still recorded as the one *blocking* Open Question in
  `SPEC/20-feature-issues-and-delivery.md`. Comp P renders the multi-parent affordances
  (chip list, add/remove checkboxes, `18 memberships over 14 issues`) because that is what
  was asked for — it does not settle the question. If single-parent wins, the Grouping
  screen becomes a radio group and the Outcomes chip list collapses to one value.

**Coverage note.** Comp P takes Home and the command palette from comp D. Comp D's other
screens — Ideas list, Board, Inspector, Settings, Login — are *not* yet restyled in this
direction. Say the word if you want them; the token layer is shared, so extending is
mechanical.

Still open from this round: whether DESIGN.md replaces the locked direction at all. Comps
O-1/O-2/O-3 and P are all **explorations** — `SPEC/` behaviour is untouched and comps A–N
were not restyled.
