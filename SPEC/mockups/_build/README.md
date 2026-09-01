# Mockup build system

The comps in `SPEC/mockups/` are **generated**, not hand-edited. Each one is a single
self-contained HTML file with its CSS inlined, which makes it trivial to open and share but
impossible to edit safely by hand — the same stylesheet is duplicated into every output.

Edit the sources here and rebuild. **Never edit a generated `comp-*.html` directly**; the
next build overwrites it.

## Running a build

```bash
python3 SPEC/mockups/_build/build_p.py   # -> comp-p-focus-roadmap.html
python3 SPEC/mockups/_build/build.py     # -> comp-o-notion-01/02/03.html
```

Both resolve their paths relative to this directory, so they run from anywhere.

Every build is reproducible: running either script against unchanged sources reproduces the
committed output byte for byte. That property is worth preserving — it is what lets a
reviewer trust that a comp matches its sources.

## Files

| File | Role |
|---|---|
| `tokens.css` | The `DESIGN.md` token layer — colour, type scale, radii, spacing. Shared by every comp. |
| `extra.css` | Component and layout CSS built on those tokens. |
| `build_p.py` | Assembles comp P. Substitutes `@@DESK:<screen>@@` with the generated sidebar, inlines the CSS, appends the screen-switching script. |
| `p_focus.frag` | Comp P's screen markup — all ten screens. |
| `build.py` | Assembles the three comp O files from the fragments below. |
| `o1_board.frag`, `o2_idea.frag`, `o3_delivery.frag` | Comp O screen markup. |

## How comp P works

- Each screen is a `<section class="screen" id="s-...">`. Only the one with `data-on="1"`
  is visible; the inline script toggles that attribute.
- Any element with `data-go="s-..."` navigates to that screen on click, so sidebar items,
  tabs and links all use one mechanism.
- `@@DESK:<key>@@` in a fragment expands to the full sidebar with `<key>` marked
  `aria-current="page"`. The `NAV` and `GO` tables in `build_p.py` define the items and
  which ones navigate.
- The build asserts no `@@` token survives substitution, and that neither stylesheet closes
  the `<style>` element. Both have caught real mistakes.

## Gotchas

- An element carrying both the `hidden` attribute and a `flex`/`grid` display class renders
  **visible** — the display class beats the user-agent `[hidden]` rule. This bit two
  separate comps. Any real implementation wants `[hidden]{display:none!important}` in its
  base styles on day one.
- An inline-block element inside a line of text drags the line box down by the strut
  descender. Fix it with a fixed-height flex line, not by adjusting `line-height`.
- Static checks are not sufficient. Every layout bug found in these comps so far was
  invisible to HTML validation and only appeared in a screenshot. Serve the file and look
  at it.
