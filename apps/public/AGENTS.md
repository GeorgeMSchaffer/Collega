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
- The site deploys as its own Vercel project with Root Directory `apps/public`.
