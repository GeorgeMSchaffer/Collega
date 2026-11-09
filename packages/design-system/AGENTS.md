# Design system

Owns shared tokens and primitives for the web client. It imports nothing else from the workspace,
and only `apps/web` may import it.

## Client design references

Comp P's structure remains locked. Comp R supersedes it for the list/detail pattern (drawer,
toolbar and row actions), idea assistant and palette. The five themes are Terrazzo, Portico,
Piazza Sera, Lagoon and Graphite; Graphite is the default, while Terrazzo is the bare `:root`.
The picker remembers its selection per browser; each theme is a self-contained `[data-theme]`
block. Comp Q is the reference rendering. Theme tokens live in `src/globals.css`;
`apps/web/app/globals.css` imports them and supplies Tailwind source roots. Keep the themes and
comps synchronized.

## Component rules

- Keep geometry in shared CSS tokens (`--control-h`, `--control-h-sm`, `--control-h-lg`,
  `--control-px`, `--field-h`, `--label-size`), not component-specific overrides.
- `CHIP_THEMES` in `src/lib/tag-colors.ts` mirrors each theme's `--card` and `--foreground`.
  Update both together to preserve the chip text's 4.5:1 contrast.
- Implement comp components as primitives, not global component classes. Use shadcn/ui conventions
  and semantic tokens; avoid raw colors and one-off Tailwind color utilities.
- Check the primitive gallery in `apps/web/app/(desk)/design-system` before wiring a primitive
  into a screen.
