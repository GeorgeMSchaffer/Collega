# Collega — how to build with this design system

**This is a CSS design system, not a React component library.** Nothing is importable
from `window`. Collega's real UI is Blazor WebAssembly, which cannot render here, so what
is bound is the **style layer**: tokens, the font, and the locked component CSS. Build
with **plain semantic HTML plus the classes below**. Do not invent a parallel class
vocabulary; do not reach for Tailwind or CSS-in-JS.

## Setup

No provider or wrapper component. Link `styles.css` and everything resolves — it
`@import`s the tokens, the `@font-face` and the component layer in the required order.

Wrap a full app screen in `.shell` (grid: 64px icon rail + content). Screens outside the
app frame — sign-in, first-login — use `.authwrap > .authcard` instead.

Geist is **bundled and self-hosted** (`fonts/geist-latin-variable.woff2`, 29 KB variable
font, weight axis 400–700). Never add a Google Fonts or CDN link.

## The styling idiom

Plain classes plus CSS custom properties. There is no utility-class system: `.p-4` and
`.text-lg` do not exist. For your own layout glue use `var(--*)` tokens directly.

| Purpose | Classes |
|---|---|
| Frame | `.shell`, `.rail` (+ `.rail a.on` for the active destination), `.body` |
| Page header | `.pagehead` (`.crumbs`, `h1`, `.sub`, `.row`, `.grow`), `.ptabs` (+ `a.on`) |
| Actions | `.btn`, `.btn.primary`, `.btn.subtle`, `.btn.danger`, `.cmdbar`, `.actionbar` |
| Surfaces | `.card`, `.tiles` > `.tile`, `.rowcard`, `.kcard` |
| Board | `.lanesec` > `h2` (+ `.dot`, `.cnt`), `.kview` > `.klanes` > `.klane`, `.emptylane` |
| Chips/state | `.chip` (+ `.on`), `.chipbar`, `.pill` (+ `.ok` / `.err` / `.info`), `.tag`, `.taglist` |
| Meaning | `.impact` (+ `.high` / `.med` / `.low`), `.prio-chip` (+ `.high` / `.med` / `.low`) |
| Forms | `.field`, `.charcount`, `.note`, `.warnbanner` |
| Idea detail | `.ideahd`, `.ideabody`, `.facts` > `.fact`, `.prose`, `.comment`, `.cmt`, `.mention` |
| People | `.avatar` (+ `.s` / `.more`), `.avatarstack`, `.avatarwrap`, `.avatarbtn` |
| Monospace | `.code` — invite codes and identifiers only |

Three rules that are load-bearing:

- **The accent means one thing.** `--accent` / `--accent-deep` mean *active, selected, or
  primary action*. Never reuse it for a new meaning; give the new meaning its own token.
  (Precedent: AI suggestions got their own teal rather than borrowing the accent.)
- **Never encode meaning in colour alone.** Status, idea type, priority and impact are
  always spelled out as text next to any colour marker.
- **Status lanes are parameterised, not hard-coded.** A lane's colour comes from
  `--lc-deep`, set inline on the lane or row: `<section class="lanesec"
  style="--lc-deep:#3E4E60">`. Every rule that reads it has a fallback, so omitting it
  degrades cleanly. Do not add per-status classes.

Corner radius is `2px` everywhere (`--radius-card`, `--radius-btn`). Only `.avatar` is
round. This is a locked decision — do not round corners further.

## Where the truth lives

Read these before styling; they are bound alongside this file and beat any summary:

- `styles.css` — entry point and import order
- `tokens/color.css` — ink ramp, surfaces, accent, semantic and impact tokens. Only
  `--ink` clears WCAG AA as body text; every chromatic value is a fill, paired with a
  `-deep` value for text.
- `tokens/type.css`, `tokens/layout.css` — font and geometry
- `components.css` — the locked component CSS, verbatim

## A build snippet

```html
<div class="shell">
  <nav class="rail"><a class="on" href="#"><span>Boards</span></a></nav>
  <main class="body">
    <header class="pagehead">
      <div class="crumbs"><a href="#">Boards</a> / Q3 Intake</div>
      <div class="row"><h1>Q3 Intake</h1><span class="grow"></span>
        <button class="btn primary">New idea</button></div>
    </header>

    <section class="lanesec" style="--lc-deep:#3E4E60">
      <h2><span class="dot"></span> In review <span class="cnt">4</span></h2>
      <article class="rowcard">
        <span class="grow">Automate weekly reporting</span>
        <span class="impact high">High impact</span>
        <span class="prio-chip med">Medium</span>
      </article>
    </section>
  </main>
</div>
```
