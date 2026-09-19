# packages/design-system

Comp P's tokens and primitives, on Tailwind CSS v4 + shadcn/ui. Imports nothing else from the
workspace, and **nothing but `apps/web` imports it** — an import from `apps/api` or any
`packages/*` layer is a lint error.

## Layout

| Path | Holds |
|---|---|
| `src/globals.css` | **The theme** — the `@theme` block, the token values, the base layer |
| `src/components/` | The primitives: `button`, `card`, `field`, `input`, `badge`, `alert`, `meter`, `marker`, `skeleton`, `states`, `denied`, … |
| `src/lib/cn.ts` | The class-merge helper |
| `test/` | Vitest + Testing Library |

Consumed as `@collega/design-system` and `@collega/design-system/globals.css`.
`apps/web/app/globals.css` imports that stylesheet and adds only the app's Tailwind `@source`
roots — the theme itself is not duplicated there.

## Conventions

- **Comp P's structure is locked; the palette is open** (`SPEC/decisions.md` 2026-09-03). Comp Q
  (`SPEC/mockups/comp-q-*.html`) is the reference rendering, carried over from
  `SPEC/mockups/_build/q.css`. Change a token here and in the comps together, or the comps stop
  being a reference.
- **Component classes from the comps (`.btn`, `.panel`, `.marker`, …) are deliberately not carried
  into CSS.** Each one is a real component in `src/components/` instead. Don't reintroduce them as
  global classes.
- Use shadcn/ui as intended rather than re-skinning it: a primitive here should be recognisable to
  anyone who knows shadcn.
- Semantic tokens only in component code — no raw hex, no one-off Tailwind colour utilities.
- `apps/web/app/(desk)/design-system` renders the primitives; check a change there before wiring
  it into a screen.
