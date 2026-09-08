# UI Feedback
This is just note document to keep feedback regarding the design of the comps

#1 ./SPEC/mockups/comp-d-focus-desk.html in general, but with the roadmap functionality layout from ./SPEC/mockups/comp-n-roadmap-multi.html

Can you create a comp that combines the two and applies the color, fonts, etc... based on the DESIGN.md rules.

---

## Answer to #1 — `comp-p-focus-roadmap.html` (2026-08-31)

Ten screens — **Login, Home, Ideas list, Board, Inspector, Roadmap, Issue, Grouping,
Settings, Command palette**. That is every screen comp D had, restyled, plus comp N's
roadmap trio. **Home is the landing screen** and now carries real copy: a first-run strip
on how an idea moves through the statuses, a line under each KPI saying what it counts, and
a standfirst on each panel saying how the list is ordered. That copy is written in product
voice and is meant to be lifted straight into the UI. Anything addressed to a reviewer of
the comp — screen list, shortcuts, which screens carry open questions — is in the chrome
band above the app frame instead, so the two are never confused. Built on the same shared token layer as the
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

**Comp D's accessibility work survives the restyle.** Verified in-browser, not asserted:
native `<button type="submit">` so Enter submits; `autocomplete="username"` paired with the
password field; every `<label for>` resolves to a real control, and no input, select or
textarea on the new screens is unlabelled; no duplicate ids. The docked inspector is still a
third grid column, so nothing is covered, there is no focus trap, and Escape just closes it.
The board still writes idea type as text on every card rather than encoding it in a dot.

**What this direction costs, measured.** `DESIGN.md`'s body-sm is 15px against comp D's
12.5px. An Ideas row measures **67px** here against comp D's **57–59px**; ten rows run
**669px** against **584px** — about **15%** more vertical space for the same page. (Comp D's
own note claims a 30px row; the browser says 57–59px once the secondary line is counted. It
is comp D's number to fix, not comp P's, but it should not be relied on.) If density matters
more than the Notion type scale, that is the trade to argue about.

Still open from this round: whether DESIGN.md replaces the locked direction at all. Comps
O-1/O-2/O-3 and P are all **explorations** — `SPEC/` behaviour is untouched and comps A–N
were not restyled.
