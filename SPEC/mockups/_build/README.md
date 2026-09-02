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
| `build_p.py` | Assembles comp P. Substitutes the `@@…@@` tokens below, inlines the CSS, appends the screen-switching script. |
| `p_core.frag`, `p_auth.frag`, `p_admin.frag`, `p_delivery.frag` | Comp P's screen markup, one fragment per output file. |
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

## The comp P set

Four files, built from one manifest at the bottom of `build_p.py`:

| File | Fragment | Area |
|---|---|---|
| `comp-p-focus-roadmap.html` | `p_core.frag` | Home, Boards, Board, Ideas, Inspector, palette |
| `comp-p-auth.html` | `p_auth.frag` | Login, register, password, View As |
| `comp-p-admin.html` | `p_admin.frag` | The `/settings/*` area |
| `comp-p-delivery.html` | `p_delivery.frag` | Issue, Roadmap, Grouping — not yet built |

Add a screen by adding a `<section class="screen" id="s-...">` to the right fragment and
an entry to that comp's `screens` list. The builder owns which screen opens first, so a
fragment never sets `data-on` itself.

## Generators

A fragment is mostly page chrome. Anything repeated across screens is a `@@TOKEN@@` that
`build()` expands from a Python function, so the two or more places it appears cannot
drift apart. That matters most for the eight org-scoped Site Admin mirrors: each is the
same component as its own-org twin with `mutable=False`, generated once and instantiated
twice rather than copied.

| Token | Expands to |
|---|---|
| `@@DESK:<key>@@` | The sidebar, with `<key>` marked `aria-current="page"` |
| `@@PROFILE@@` | The profile form |
| `@@ROLLUP:<key>@@` | A Site Admin cross-organization list — read-only by construction |
| `@@EDITOR:<entity>:<sfx>:rw\|ro@@` | A List + panel admin screen. `ro` is the Site Admin variant |
| `@@SCOPEBAR:<entity>:<back>@@` | The "you are viewing Acme Robotics" banner |
| `@@GUARD:ADMIN\|SITE\|REFUSED:<entity>[:<back>]@@` | The refusal a role sees instead of the page |
| `@@INVITE:<sfx>@@`, `@@IMPORT:<sfx>@@` | Invite-code panel, CSV import screen |
| `@@BOARDFORM:<sfx>:new\|edit@@` | The two-column swimlane picker |
| `@@AIASSIST@@`, `@@AIPROMPT@@`, `@@USAGE@@` | The three AI/usage screens |

**Suffixes must be unique per file.** Every generator mints ids from its `sfx`, so two
instances sharing one suffix silently produce duplicate `id`s, and each control's
`aria-describedby` then resolves to whichever screen the browser saw first. `@@EDITOR@@`
guards against this by prefixing the entity key itself; the rest rely on the caller.

## Shared mechanisms

These live in `extra.css` and are **frozen** — change them in a dedicated amendment, never
inside a slice that is adding screens.

### Role gating

`data-role` on `<body>` is the viewer's role. `data-roles` on any element lists the roles
allowed to see it; untagged elements are visible to everyone.

```html
<button class="btn pri" data-roles="SiteAdmin OrgAdmin">Add status</button>
```

The rule hides the *non-matching* case rather than showing the matching one, so a surviving
element keeps its own `display`. It is `!important` on purpose: gated elements often carry
an inline `display` style, and an inline style beats any selector.

**Sizing gated grid columns.** `display:none` removes a grid *item*, never a grid *track*.
A fixed `356px` column keeps its width after its only child is hidden, leaving dead space.
Declare the track `auto` and put the width on the child instead.

### State variants

`data-state` on a `.screen` (`normal` / `empty` / `loading` / `error`); `data-when` on any
block belonging to particular states. A block may list several: `data-when="normal empty"`.

Tag **both** sides. A pristine field left untagged stays visible in the error state, and
you get two of it — this is easy to miss and only shows in a screenshot.

### Denied actions

Use `aria-disabled="true"` with `aria-describedby` pointing at the reason. Never the
`disabled` attribute: it removes the control from the tab order, so a keyboard or
screen-reader user meets neither the control nor the explanation.

```html
<span class="deniedwrap" data-roles="User ReadOnly">
  <button class="btn pri" aria-disabled="true" aria-describedby="p-why-add">Add status</button>
  <span class="denied" id="p-why-add">Administrators only</span>
</span>
```

### Not-yet-built marking

Set `wip` on a comp in the manifest and every screen in that file gets a strip above the
app frame. Reviewer voice, never product copy — nothing inside the frame claims to be
shippable when it is not.

## Checks the build runs for you

- No stylesheet closes the `<style>` element.
- CSS comment markers balance, and braces balance. A stray `*/` makes the parser discard
  everything to the next `}`, so a whole rule vanishes while the file still reads fine.
  That cost a browser session to find once; the assertion exists so it cannot recur.
- Every `@@TOKEN@@` was substituted.
- Every `var(--custom-property)` used in a stylesheet or a fragment is actually defined.
  A leftover token from a retired comp renders the element unstyled and nothing complains;
  this caught two.
- Any `data-go` target that no comp defines is reported as *not built yet*, so a screen
  linking to a route nobody has written is visible in the build output rather than as a
  dead click.

## Checks the build cannot run for you

Serve the files and look at them, at more than one role and state. Every layout bug found
in this set so far — a gated control rendering twice, a grid track holding width after its
child was hidden, a duplicated form field, five unlabelled checkboxes — passed every static
check and was only visible in a screenshot.

```bash
cd SPEC/mockups && python3 -m http.server 8777
# then e.g. http://127.0.0.1:8777/comp-p-admin.html?role=ReadOnly&state=loading
```

`?role=`, `?state=` and `?screen=` are honoured on load, and cross-file links carry the
current role and state with them.
