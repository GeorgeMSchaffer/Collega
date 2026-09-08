# design-sync notes — Collega

## Shape: out of the converter's envelope

Collega is **not a JS/React design system**. The UI is Blazor WebAssembly — 41 `.razor`
components on `Microsoft.FluentUI.AspNetCore.Components` 4.11.0, with co-located
`.razor.css` scoped styles. There is no Storybook, no `dist/`, and the only `package.json`
is `@playwright/test` for the E2E suite.

The blocker is the **runtime**, not the build: Claude Design renders React from
`window.<globalName>.*`, and Razor components are .NET IL in a WASM runtime. No bundler
bridges that. `package-build.mjs` and the rest of the converter cannot run here.

**Decision (user, 2026-08-31): sync the style layer only.** No components, no `.d.ts`, no
previews. Reimplementing the components as React was offered and rejected — it would
create a second library in a language the team does not ship.

Consequence: `_ds_sync.json` is **omitted**. With zero components there are no
`renderHashes` or `sourceKeys` to anchor, so the honest result is no anchor — the next
sync re-derives everything. That is correct, not a failure.

## Palette conflict resolved 2026-08-31

The 2026-08-31 restyle recoloured all 41 comps but never touched the canonical spec, so
`SPEC/20-feature-client-ui.md` §Color palette still specified the old indigo/warm-neutral
system while the comps had moved to blue/cool-neutral.

Resolved by user decision: the **new blue palette is canonical**. Both
`SPEC/20-feature-client-ui.md` and `src/Collega.Client/CLAUDE.md` were updated, following
the repo's existing "Changed <date> by user decision" idiom (the same pattern the
2026-08-12 typography change used).

**Still outstanding — not part of this sync:** `src/Collega.Client/wwwroot/css/app.css`
is unmigrated and still ships indigo `#5b5fc7` with 6px/4px radii.

## Findings to act on

1. **The automated restyle collapsed three token pairs** in
   `comp-c-review-06-lockin-v5-final.html`, because the colour classifier mapped distinct
   source values onto one target:
   - `--ink-3` == `--ink-2` (`#3E4E60`)
   - `--im-high-deep` == `--im-low-deep` (`#B64B4B`) — **high and low business impact
     render identically**, which breaks the repo's own "colour has meaning" rule
   - `--im-med-soft` == `--im-low-soft` == `--accent-soft` (`#F1F3F6`)

   `tokens/color.css` de-collides these using only values already in the documented
   29-colour palette (impact high→red, med→amber, low→neutral). **The comps themselves
   were not changed** — they still carry the collapsed values. Worth a pass.

2. **The D-SUGGEST teal gap narrowed.** `--sug: #116b5e` exists specifically to be
   unmistakable against the accent. Indigo sat ~68° of hue away; the new blue sits ~38°
   away. They remain separable by lightness, but re-check the suggestion chip, tinted
   field and 3px left border when `app.css` is migrated.

3. **`.env.local` is untracked and not gitignored.** It was excluded from the 2026-08-31
   commit by staging explicitly rather than `git add -A`. Consider adding it to
   `.gitignore` before someone commits it.

## Operational

- Git in this repo is lock-contended (GitHub Desktop watches it). A stale zero-byte
  `.git/index.lock` was cleared during this run. Use 300s+ timeouts on git writes.
- `ds-bundle/` is build output — gitignored, not committed.
