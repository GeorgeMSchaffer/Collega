# apps/public

Static clickable prototype of the Org Admin screens (29 screenshots with hash routing and
percent-positioned hotspots). Not part of the application: no framework, no dependencies, no
workspace imports, and no build step, so `pnpm check` has nothing to run here.

- `index.html` — the whole prototype. Screen list `S`, hotspot tables `HS`/`NAV`, and the
  `SHOTS` image path are at the top of the script. Hotspot coordinates are in the 960×600
  source-pixel space of the PNGs.
- `shots/` — the source screenshots, `NN-name.png`, 960×600. A new screen needs a PNG here, an
  entry in `S`, and hotspots in `HS`.
- Press `H` to show hotspots and `G` for the calibration grid when placing them.
- Preview: `python3 -m http.server -d apps/public`.
- Deploys as its own Vercel project with Root Directory `apps/public` (see `vercel.json`).
