# Bundled fonts

## Geist

`geist-latin-variable.woff2` — 29 KB, latin subset, variable weight axis covering 400–700.

- **Source:** `https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFWNOITd.woff2`, resolved from the Google Fonts CSS API (`family=Geist:wght@400;500;600;700`) on 2026-08-12.
- **Upstream:** [vercel/geist-font](https://github.com/vercel/geist-font)
- **License:** SIL Open Font License 1.1 — redistribution and bundling are permitted, including in commercial work. The OFL requires the font not be sold on its own and that any derivative renamed; neither applies here since we ship it unmodified.

**Why self-hosted rather than a CDN link:** no third-party request on page load, works offline, and nothing external can change under us. It costs 29 KB of repo assets.

**Why only the latin subset:** Google Fonts serves Geist split by `unicode-range` (latin, latin-ext, cyrillic, cyrillic-ext, greek, vietnamese). The app has no content in those other scripts, so bundling them would add weight nobody loads. If Collega ever ships non-latin UI text, pull the matching subsets from the same CSS endpoint and add parallel `@font-face` blocks with their `unicode-range` intact — do not replace this file with the full set, or every user downloads every script.

**Why one file for four weights:** Geist is a variable font. The four weight URLs in the Google CSS all point at this same file; the `font-weight: 400 700` range in the `@font-face` declaration is what lets the browser synthesize each weight from it. Do not add per-weight files — they would be the same bytes four times.
