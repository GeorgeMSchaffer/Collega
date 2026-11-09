# apps/public

The public WorkSprint site, static: no framework, no dependencies, no workspace imports and no
build step, so `pnpm check` has nothing to run here.

- `index.html` — the app-aligned spacious narrative landing page, taken from
  `SPEC/mockups/worksprint-marketing-app-narrative.html` (proposal bar and sibling-concept links
  removed), with the Workflow story Figma hero and its existing `workflow/assets/` track SVGs.
  Styles and the demo form script are in `worksprint-assets/`. The indexable marketing pages load
  Vercel Analytics through a local queue stub and `/_vercel/insights/script.js`; their CSP allows
  same-origin scripts and connections only. This is independent of `apps/web`.
- The home page product preview is a five-slide Field Notes tour, replacing the feature-image
  cards. `worksprint-assets/product-tour.css` and `product-tour.js` own its styles and behavior.
  Captions sit beside the screenshot on desktop and above it on mobile, with a thumbnail chapter
  strip, image-overlay arrows, keyboard navigation and touch swipes. Slides use a 240ms directional
  slide-and-fade with a subtle amber screen edge. Autoplay is opt-in via Play tour, advances every
  six seconds, and pauses on hover, focus, hidden pages and when off-screen. Manual navigation
  stops autoplay; reduced motion disables it and the animations. Without JavaScript, the first
  screenshot and caption remain; interactive controls stay hidden.
- `/tour/` is a separate guided-tour review page. Its five guided stops use approved
  captures from `worksprint-assets/`; its optional screen index uses the 29 owner-requested
  prototype captures from `prototype/shots/`. Keep the old Collega labels and sample-data context
  clear, and do not imply that prototype-only screens are available in the current app. The page
  follows the static site's visual system and remains out of the sitemap and search index until
  indexing is approved.
- The homepage, tour and five product pages share the same header: Product tour, Beta FAQ,
  Login and a Request beta access button. Product tour is a click/tap disclosure with
  Guided overview, Ideas, Boards, Backlog, Sprints and Roadmap. The footer repeats that grouping
  with Privacy. Keep these static links consistent across all seven pages; `site-navigation.js`
  adds Escape, outside-click and focus-leave dismissal and opens the homepage privacy disclosure
  for cross-page links. The owner approved linking the tour from this navigation.
- `ideas/ boards/ backlog/ sprints/ roadmap/` — one product page per area, each with its own title,
  description, canonical and `sitemap.xml` entry. Copy states only what the app does today
  (the roadmap shows sprints; Outcomes are not built, so the page does not mention them).
- `robots.txt`, `sitemap.xml`, `favicon.svg` — canonical host is assumed to be `https://worksprint.io`.
- `workflow/` — second landing concept built from the Figma file "WorkSprint — Landing page concepts",
  frame `01 / Workflow story / Desktop` (3:2). Own CSS, demo-only form, SVGs from the file in
  `workflow/assets/`. The product preview uses the approved board capture in `worksprint-assets/`
  where the Figma frame has a placeholder.
- `prototype/` — clickable prototype of the Org Admin screens (29 screenshots, hash routing,
  percent-positioned hotspots in 960×600 source px). Press `H` for hotspots, `G` for the grid. `workflow/` and `prototype/` are `noindex`.
- Preview: `python3 -m http.server -d apps/public`.
- Deploys as its own Vercel project with Root Directory `apps/public` (see `vercel.json`).
