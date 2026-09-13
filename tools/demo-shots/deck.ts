/**
 * `demo/deck.html` — the screenshot set, in order, with its captions.
 *
 *   pnpm shots      # re-photograph the product
 *   pnpm deck       # rebuild this page around the new images
 *
 * Generated rather than hand-written for one reason: the captions already live in `shots.js`, and a
 * hand-written page would hold a second copy of them that goes stale the first time a caption is
 * reworded. The page references the images by relative path, so `demo/deck.html` and
 * `demo/screenshots/` travel together.
 */

import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHOTS, type Shot } from './shots.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'demo', 'deck.html')

const missing = SHOTS.filter((shot) => !existsSync(join(ROOT, 'demo', 'screenshots', shot.file)))
if (missing.length > 0) {
  console.error(`\n\x1b[31mNo image for: ${missing.map((s) => s.file).join(', ')}\x1b[0m`)
  console.error('Run `pnpm shots` first.\n')
  process.exit(1)
}

const text = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const step = (index: number): string => String(index + 1).padStart(2, '0')

const plate = (shot: Shot, index: number): string => `
      <article class="plate" id="${shot.id}">
        <div class="plate-meta">
          <span class="step">${step(index)}</span>
          <span class="route">${text(shot.route)}</span>
          <span class="role">${text(shot.as)}</span>
        </div>
        <h2>${text(shot.title)}</h2>
        <p class="caption">${text(shot.caption)}</p>
        <figure class="mat">
          <img src="screenshots/${shot.file}" alt="${text(shot.title)} — the ${text(shot.route)} screen" width="3200" height="2000" loading="lazy" />
        </figure>
      </article>`

const index = (shot: Shot, i: number): string =>
  `<li><a href="#${shot.id}"><span class="step">${step(i)}</span>${text(shot.title)}</a></li>`

const html = `<title>Collega Product Walkthrough</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Geist:wght@400;500&family=Geist+Mono:wght@400;500&display=swap"
/>
<style>
  :root {
    --ground: #eef2f6;
    --surface: #ffffff;
    --ink: #1b2634;
    --ink-muted: #5d6c7e;
    --ink-faint: #8593a2;
    --accent: #46647f;
    --hairline: #d7dee5;
    --mat: #e1e8ef;
    --mat-edge: #ccd6df;
    --chip: #e3eaf0;
    --shadow: 0 1px 2px rgba(27, 38, 52, 0.06), 0 14px 34px rgba(27, 38, 52, 0.1);

    --display: "Newsreader", Georgia, "Times New Roman", serif;
    --body: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #111820;
      --surface: #19212b;
      --ink: #e3eaf1;
      --ink-muted: #96a4b3;
      --ink-faint: #6f7e8e;
      --accent: #93b3ce;
      --hairline: #29343f;
      --chip: #233040;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 18px 40px rgba(0, 0, 0, 0.45);
    }
  }

  :root[data-theme="dark"] {
    --ground: #111820;
    --surface: #19212b;
    --ink: #e3eaf1;
    --ink-muted: #96a4b3;
    --ink-faint: #6f7e8e;
    --accent: #93b3ce;
    --hairline: #29343f;
    --chip: #233040;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 18px 40px rgba(0, 0, 0, 0.45);
  }

  body {
    background: var(--ground);
    color: var(--ink);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  .page {
    max-width: 1180px;
    margin-inline: auto;
    padding-inline: 24px;
    padding-block: 56px 72px;
  }

  a {
    color: inherit;
  }

  a:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 3px;
  }

  /* --- masthead ------------------------------------------------------------------------------ */

  .masthead {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-bottom: 36px;
    border-bottom: 1px solid var(--hairline);
  }

  .eyebrow {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  .masthead h1 {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(40px, 6vw, 64px);
    line-height: 1.04;
    letter-spacing: -0.02em;
    margin: 0;
    text-wrap: balance;
  }

  .masthead h1 em {
    font-style: italic;
    color: var(--accent);
  }

  .thesis {
    margin: 0;
    max-width: 62ch;
    font-size: 19px;
    line-height: 1.6;
    color: var(--ink-muted);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 28px;
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    font-family: var(--mono);
    font-size: 12.5px;
    letter-spacing: 0.03em;
    color: var(--ink-muted);
  }

  .facts b {
    color: var(--ink);
    font-weight: 500;
  }

  /* --- contents ------------------------------------------------------------------------------ */

  .contents {
    padding-block: 32px 8px;
  }

  .contents h2 {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 0 0 16px;
  }

  .contents ol {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2px 32px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .contents a {
    display: flex;
    gap: 14px;
    padding: 7px 0;
    text-decoration: none;
    font-size: 15px;
    color: var(--ink-muted);
  }

  .contents a:hover {
    color: var(--ink);
  }

  .step {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    flex: none;
  }

  /* --- plates -------------------------------------------------------------------------------- */

  .plates {
    display: flex;
    flex-direction: column;
  }

  .plate {
    padding-block: 52px;
    border-top: 1px solid var(--hairline);
    scroll-margin-top: 24px;
  }

  .plate-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
  }

  .route {
    color: var(--ink-muted);
    letter-spacing: 0.01em;
  }

  .role {
    margin-left: auto;
    padding: 3px 9px;
    border-radius: 3px;
    background: var(--chip);
    color: var(--ink-muted);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .plate h2 {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(26px, 3.2vw, 34px);
    line-height: 1.15;
    letter-spacing: -0.015em;
    margin: 0 0 12px;
    max-width: 24ch;
    text-wrap: balance;
  }

  .caption {
    margin: 0 0 28px;
    max-width: 68ch;
    font-size: 16.5px;
    color: var(--ink-muted);
  }

  /* The screenshots are light-theme captures, so they sit on a light mat in both themes: a frame
     the page puts around them deliberately, rather than a bright rectangle punched into a dark
     page. */
  .mat {
    margin: 0;
    padding: clamp(12px, 2.2vw, 26px);
    background: var(--mat);
    border: 1px solid var(--mat-edge);
    border-radius: 8px;
  }

  .mat img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 4px;
    border: 1px solid rgba(27, 38, 52, 0.14);
    box-shadow: var(--shadow);
    background: #ffffff;
  }

  /* --- colophon ------------------------------------------------------------------------------ */

  .colophon {
    margin-top: 52px;
    padding: 28px 30px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 8px;
  }

  .colophon h2 {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 0 0 14px;
  }

  .colophon p {
    margin: 0 0 14px;
    max-width: 68ch;
    font-size: 15.5px;
    color: var(--ink-muted);
  }

  .colophon p:last-child {
    margin-bottom: 0;
  }

  .colophon code,
  .colophon pre {
    font-family: var(--mono);
    font-size: 13px;
  }

  .colophon pre {
    margin: 0 0 16px;
    padding: 14px 16px;
    overflow-x: auto;
    background: var(--ground);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    color: var(--ink);
  }

  @media (max-width: 640px) {
    .page {
      padding-block: 36px 48px;
    }

    .plate {
      padding-block: 38px;
    }

    .role {
      margin-left: 0;
    }
  }
</style>

<div class="page">
  <header class="masthead">
    <p class="eyebrow">Product walkthrough</p>
    <h1>Collega, from first rough note <em>through delivery</em>.</h1>
    <p class="thesis">
      Eleven screens in the order a demo runs them, each one photographed from a running build
      against the seeded Acme Robotics organization. Nothing here is a mockup, and nothing has been
      retouched.
    </p>
    <ul class="facts">
      <li><b>${SHOTS.length}</b> screens</li>
      <li><b>3</b> permission levels</li>
      <li><b>22</b> ideas across <b>2</b> boards</li>
      <li>captured at <b>1600×1000</b> @2x</li>
    </ul>
  </header>

  <nav class="contents" aria-label="Contents">
    <h2>The run of show</h2>
    <ol>
${SHOTS.map(index)
  .map((row) => `      ${row}`)
  .join('\n')}
    </ol>
  </nav>

  <main class="plates">
${SHOTS.map(plate).join('\n')}
  </main>

  <footer class="colophon">
    <h2>How these were made</h2>
    <p>
      Every image on this page is written by <code>tools/demo-shots</code>, which drives Chromium
      against a local Collega and signs in as the seeded demo accounts. A screen that changes is
      re-photographed by re-running it — there is no folder of hand-cropped PNGs to keep in step.
    </p>
    <pre>pnpm start   # API on :3001, web on :3000, database seeded
pnpm shots   # writes demo/screenshots
pnpm deck    # rebuilds this page</pre>
    <p>
      The accounts, the two organizations and the twenty-two ideas all come from the demo seed;
      <code>demo.md</code> lists them. The discussion on screen 08 is a real comment, posted through
      the UI by Noah Contributor while the capture was running.
    </p>
  </footer>
</div>
`

writeFileSync(OUT, html)
console.log(`\n  demo/deck.html — ${SHOTS.length} screens\n`)
