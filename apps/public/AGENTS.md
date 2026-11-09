# Public site

`apps/public` is an independent static site: no framework, build step, dependencies, workspace
imports or relationship to `apps/web`.

- Keep marketing copy accurate to behavior that ships today. Outcomes are not built; do not claim
  them. Each product page owns its title, description and canonical URL and must appear in
  `sitemap.xml`.
- The indexable marketing pages use Vercel Analytics through the local queue stub and
  `/_vercel/insights/script.js`. Keep their CSP limited to same-origin scripts and connections.
  `robots.txt` and `sitemap.xml` use `https://worksprint.io`; `workflow/` and `prototype/` stay
  `noindex`.
- `worksprint-assets/` owns the home page's Field Notes tour, shared styles and demo scripts.
  Read `worksprint-assets/product-tour.md` before changing the tour.
- `workflow/` owns the second landing concept, demo-only form, styles and SVGs under `assets/`.
  `prototype/` owns the 29-screen hash-routed Org Admin screenshot prototype; `H` toggles hotspots,
  `G` toggles the grid, and hotspot positions use the 960×600 source coordinate system.
- Screenshot PNGs remain untouched as full-resolution links and compatibility fallbacks.
  `prototype/shots/optimized/` and `worksprint-assets/optimized/` contain lossless WebP variants;
  `<picture>`/`srcset`/`sizes` select for placement width and device pixel density. The tour has
  separate 160/320px thumbnails and only eagerly loads its active/next slide when visible.
  Product-page screenshots scale to their panel with `height:auto`; prototype hotspots retain
  their original 8:5 coordinate system.
- Regenerate with `python tools/public-images/optimize.py` from the repository root, using
  Pillow with WebP support (image tooling only, not a site dependency). It preserves exact
  aspect ratios, never upscales, verifies decoded pixels against the source/resized pixels,
  and discards any resized variant that costs at least as many bytes as a larger variant.
  It also refreshes static picture candidates and the prototype's generated `sources.js`.
  `tools/public-images/originals.zip` holds byte-for-byte backups outside the deployed site;
  reruns retain earlier versions. `tools/public-images/manifest.json` records original hashes,
  backup entries, dimensions, sizes and variant URLs for reuse in product/user guides.
- The site deploys as its own Vercel project with Root Directory `apps/public`.

- `/tour/` is a separate guided-tour review page. Its five guided stops use approved
  captures from `worksprint-assets/`; its optional screen index uses the 29 owner-requested
  prototype captures from `prototype/shots/`. Keep the old Collega labels and sample-data context
  clear, and do not imply that prototype-only screens are available in the current app. The page
  follows the static site's visual system and remains out of the sitemap and search index until
  indexing is approved.
- The homepage, tour and five product pages share the same header: Product tour, Beta FAQ,
  Login and a Request beta access button. Product tour is a click/tap disclosure with
  Guided overview, Items, Boards, Backlog, Sprints and Roadmap. The footer repeats that grouping
  with Privacy. Keep these static links consistent across all seven pages; `site-navigation.js`
  adds Escape, outside-click and focus-leave dismissal and opens the homepage privacy disclosure
  for cross-page links. The owner approved linking the tour from this navigation.
