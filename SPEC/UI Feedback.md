# UI Feedback

This is just note document to keep feedback regarding the design of the comps

> **Note.** A copy of this file also exists on the `operational-logging-plan` worktree
> (`.claude/worktrees/operational-logging-plan/SPEC/UI Feedback.md`), where it was first
> written. This is the canonical copy; delete the worktree one when convenient.

---

## #1 — Focus Desk + multi-parent roadmap, styled per DESIGN.md

> `comp-d-focus-desk.html` in general, but with the roadmap functionality layout from
> `comp-n-roadmap-multi.html`. Can you create a comp that combines the two and applies
> the color, fonts, etc... based on the DESIGN.md rules.

**Answered by `comp-p-focus-roadmap.html` (2026-08-31).** Five screens: Home (comp D's
KPI row, attention table and activity feed), Roadmap, Issue, Grouping, Command palette.

Two things worth knowing about the result:

- **The roadmap needed a new idea to work.** Comp N distinguishes outcomes with tinted
  bars. DESIGN.md forbids a structural fill from the sticker palette, and comp O-3 had
  already shown that neutral bars alone lose the outcome at a glance. Comp P encodes
  **"shared" in the border style — a dashed outline — rather than a hue.** That is not
  colour, so it survives greyscale, colour blindness and a printed page, none of which a
  tint does. The outcome itself keeps a category dot with its name always beside it.
- **Using comp N is a layout choice, not a decision.** Outcome ↔ Issue cardinality is
  still recorded as the one *blocking* Open Question in
  `SPEC/20-feature-issues-and-delivery.md`. Comp P renders the multi-parent affordances
  (chip list, add/remove checkboxes, `18 memberships over 14 issues`) because that is what
  was asked for — it does not settle the question. If single-parent wins, the Grouping
  screen becomes a radio group and the Outcomes chip list collapses to one value.

Still open from this round: whether DESIGN.md replaces the locked direction at all. Comps
O-1/O-2/O-3 and P are all **explorations** — `SPEC/` is untouched and comps A–N were not
restyled.
