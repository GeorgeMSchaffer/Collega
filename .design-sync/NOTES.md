# design-sync notes — Collega

## Shape: package (React), since 2026-09-08

Collega is now a **React design system**: `@collega/design-system`, 29 exported components on
Tailwind CSS v4 + shadcn/ui. The converter runs normally.

This replaces the 2026-08-31 sync entirely. That run recorded `shape: "style-layer-only"` because
the UI was Blazor WebAssembly — 41 `.razor` components that no bundler can turn into
`window.<globalName>.*`. The TypeScript conversion (Waves D/E of
`SPEC/50-typescript-migration.md`) landed since, so that decision no longer applies. **The old
project (`81cdd465-640b-4c96-bdc8-197bb73cbb59`, "Collega Design System") still holds that Blazor
CSS layer and is now obsolete** — by user decision this sync targets a fresh project instead. Once
the new one is live, the old project can be deleted.

## Running it

```sh
pnpm i --frozen-lockfile
pnpm -F @collega/design-system build      # emits dist/ (tsc)
./.design-sync/build-css.sh               # emits dist/collega.css (Tailwind)
node .ds-sync/resync.mjs --config .design-sync/config.json \
  --node-modules packages/design-system/node_modules \
  --entry ./packages/design-system/dist/index.js --out ./ds-bundle
```

`cfg.buildCmd` chains the two build steps. `--node-modules` must be the **package's own**
`node_modules` — react lives there under pnpm, not at the repo root.

### The stylesheet needs compiling first

`cfg.cssEntry` points at `packages/design-system/dist/collega.css`, which is a **build artifact**,
not source. The design system styles itself with Tailwind utility classes, and Tailwind only emits
utilities it finds in the sources it scans — so the bundle needs a compiled stylesheet, and that
stylesheet has to cover more than the components themselves. `.design-sync/tailwind-entry.css` is
the input: it pulls in the theme, scans the design system, the authored previews and `apps/web`,
and adds a **safelist** of generic layout/spacing/type/colour utilities so the design agent can
compose new screens rather than only re-render existing ones. Rerun `build-css.sh` after any theme
or safelist change, and before the converter.

`font-serif` is deliberately **not** in the safelist: Tailwind's default serif stack names Cambria,
which fired `[FONT_MISSING]` for a family Collega never uses.

### Fonts are self-hosted, on purpose

`apps/web/app/layout.tsx` loads Geist from Google Fonts with a `<link>`. A rendered design gets
only `styles.css` and its import closure, so `.design-sync/fonts/` carries real woff2 files
(Geist + Geist Mono, latin and latin-ext, SIL OFL 1.1) wired through `cfg.extraFonts`. Do not swap
this for a remote `@import` — previews would render in a fallback face whenever the font host is
unreachable, and the render check would grade that as fine.

## Repo changes this sync required

Two were latent bugs in `@collega/design-system`'s own manifest, both found by the converter:

1. **`exports["./globals.css"]` pointed at `./src/globals.css`, which did not exist** — the Tailwind
   theme lived in `apps/web/app/globals.css`. Fixed by moving the theme into the design system
   (where the components it styles live) and having `apps/web` import it and add only its own
   `@source` roots. `tailwindcss` became a devDependency of the package as a result: it now ships a
   stylesheet that does `@import "tailwindcss"`.
2. **No top-level `types` field** — types were declared only inside `exports`. The converter's
   ts-morph pass reads `pkg.types`, fell back to a nonexistent `index.d.ts`, and discovered
   **zero** components (`[ZERO_MATCH]`, "tokens-only DS"). One line fixed it. Anything else reading
   `types` (older `moduleResolution`, some editors) was equally broken.

## Findings to act on

1. **The base layer does not style every input type.** `packages/design-system/src/globals.css`
   keys off `input[type=text|password|search|file]`. An `Input` with `type="email"`, `"url"`,
   `"number"` or `"tel"` renders with **no border, padding or background** — it reads as plain
   text. Latent today (the app only uses text/password), and the `Input` JSDoc records that this
   exact class of bug already shipped once. Previews use `type="text"` for the email field and
   `Input.tsx` documents the limitation. Worth widening the selector list.
2. **Turbo cannot spawn child processes in the Claude Code web container** — `pnpm check` fails
   with `Exec format error (os error 8)` on a different random package each run. Not a repo defect:
   run the same checks directly (`pnpm run lint`, then `pnpm -F <pkg> typecheck` / `test`) to
   verify. Note `@collega/application`'s typecheck needs `@collega/domain` built first, which turbo
   normally handles.
3. **Node version.** `.nvmrc`/`engines` want ≥ 24.20.0; this container ran 22.22.2. Everything
   built and tested fine, but that is not the pinned toolchain.

## Known render warns

None. The final validate run was clean — 29/29 previews render, zero warnings.

Four components carry `cfg.overrides.<Name>.cardMode = "column"` (Meter, Skeleton, SkeletonRegion,
SkeletonRows): their stories are full-width bars that overflow a multi-column grid cell. That is
the applied remedy for `[GRID_OVERFLOW]`, not an outstanding warning.

## Re-sync risks

- **The stylesheet is a build artifact and is easy to forget.** Run `build-css.sh` *before*
  `resync.mjs`, and re-run it after editing previews — `tailwind-entry.css` scans
  `.design-sync/previews/`, so a new utility class in a preview is missing from the CSS until it
  is recompiled. A preview that renders unstyled almost always means a stale `collega.css`.
- **The safelist is a guess at what the design agent will reach for**, not a measured set. If
  designs come back with unstyled layout, widen the `@source inline(...)` blocks rather than
  letting the agent write bespoke CSS. It costs ~250 KB today; that is the trade being made.
- **`apps/web` is a scan source.** Utilities used only by the app are in the bundle, so deleting an
  app screen can silently remove a utility a design depended on.
- **Fonts were fetched from Google Fonts once, at sync time**, and committed. If Geist ships a new
  version upstream the committed files will not track it.
- **The conventions header enumerates real names** (components, semantic colour names, category
  tokens, radius). All of them were verified against the built artifacts on 2026-09-08. Re-verify
  after any theme rename — a name that stops resolving makes the design agent write vocabulary
  that silently does nothing.
- **`src/Collega.*` is deleted at slice F6.** Nothing in this sync depends on it any more (the
  Geist woff2 there was *not* reused — `.design-sync/fonts/` holds its own copies), so F6 should
  not disturb the sync.

## Operational

- The upload did not run on 2026-09-08: `DesignSync` had no design-system authorization in the
  claude.ai/code session, so **no project was created and `config.json` carries no `projectId`**.
  The build is complete and verified; only the upload is outstanding. The next run creates the
  project, records the pin, and uploads — everything else can be carried forward.
- Git in this repo is lock-contended on the user's own machine (GitHub Desktop watches it). Use
  300s+ timeouts on git writes there; not an issue in the container.
- `ds-bundle/`, `.ds-sync/` and `.design-sync/.cache/` are build output — gitignored, not
  committed. `.design-sync/{config.json,NOTES.md,conventions.md,previews/,fonts/,
  tailwind-entry.css,build-css.sh}` are sync inputs and **are** committed.
