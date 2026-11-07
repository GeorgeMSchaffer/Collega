# apps/public

The public WorkSprint site, static: no framework, no dependencies, no workspace imports and no
build step, so `pnpm check` has nothing to run here.

- `index.html` — the app-aligned spacious narrative landing page, taken from
  `SPEC/mockups/worksprint-marketing-app-narrative.html` (proposal bar and sibling-concept links
  removed). Styles and the demo form script are in `worksprint-assets/`; its CSP allows only
  same-origin assets, so nothing external can be added without changing the `<meta>` policy.
- `prototype/` — clickable prototype of the Org Admin screens (29 screenshots, hash routing,
  percent-positioned hotspots in 960×600 source px). Press `H` for hotspots, `G` for the grid.
- Preview: `python3 -m http.server -d apps/public`.
- Deploys as its own Vercel project with Root Directory `apps/public` (see `vercel.json`).
