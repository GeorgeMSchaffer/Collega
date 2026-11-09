# product-tour

A [Claude Code](https://code.claude.com) skill that builds a first-run interactive walkthrough for an app — spotlighted elements, step-by-step tooltips with Next / Back / Skip, an optional pointing-hand cursor, and the state logic that makes the tour appear **exactly once and never nag again**.

Built on [driver.js](https://driverjs.com) (≈8 KB gzipped, no dependencies), with working React / Next.js implementations you can drop in.

## What it does

A tour is the one piece of UI that interrupts someone on purpose, so the bar is high. The tooltips are the easy part. The skill spends its effort on the parts that actually go wrong:

| Phase | What happens |
|---|---|
| 0 | Settles the product decision first: everyone-once vs new-signups-only, and whether skipping counts as done (it should) |
| 1 | Single-page vs multi-page — and how to mount the runner *above* the router so a tour can cross pages without losing its place |
| 2 | Anchors targets on a dedicated `data-tour` attribute, never on class names or DOM structure, so a redesign can't silently break it |
| 3 | Step copy that answers "why do I care", two sentences each, 10–20 steps max |
| 4 | **Exactly-once state** with two stores — a server flag as source of truth, local storage as a same-device cache that can only ever *suppress* a tour, never start one — plus a tour version for re-qualifying everyone after a rewrite |
| 5 | Targets that don't exist yet (auth-gated, async) and targets that exist but are invisible (`display:none` on mobile — `skipMissingElement` doesn't cover that), with a progress counter that never skips a number |
| 6 | Restyling to the app's design tokens, dark mode including the popover arrow, `prefers-reduced-motion` |
| 7 | The guiding hand: a cursor that taps whatever's spotlighted, tracked on an animation frame so it doesn't lag the smooth-scroll, `pointer-events: none` so it can never eat a click |
| 8 | A test list — both themes, phone width, every exit path, backward across page boundaries, and the background-tab `requestAnimationFrame` throttling trap that looks exactly like a bug in your code |

## Install

```bash
git clone https://github.com/nt11111/product-tour ~/.claude/skills/product-tour
```

Restart Claude Code (or start a new session). Skills in `~/.claude/skills/` are picked up automatically.

For a single project instead of globally, clone into `.claude/skills/product-tour` inside the repo.

## Use

Claude triggers it on its own when you say things like:

- "add a product tour / walkthrough / guided tour / onboarding flow"
- "show new users around the app" / "walk people through the site on first login"
- "people are confused and can't find features"
- "use driver.js / Shepherd / Intro.js / Joyride"
- "the tour keeps coming back" / "the tour breaks on mobile"

Or invoke it directly: `/product-tour`

## What's inside

```
SKILL.md                          the process, phase by phase
references/
  driver-js.md                    driver.js 1.8 API traps, verified against the dist source
  multi-page.md                   spanning pages without losing position
  state-and-triggering.md         the two-store model and who sees the tour
  writing-steps.md                copy that gets read
assets/                           working React / Next.js implementation
  tour-state.js                   exactly-once state: server flag + local cache + version
  tour-steps.js                   the step catalog, grouped by page, desktop/mobile tagged
  tour-dom.js                     wait-for-target and real visibility checks
  tour-run.js                     in-flight position mirrored to sessionStorage, so a
                                  reload mid-tour resumes instead of restarting
  product-tour.jsx                the component that mounts above the router
  tour-launcher.jsx               a permanent "Take the tour" entry point
  hand-cursor.jsx                 the pointing hand
  tour-theme.css                  themed popover, light + dark, reduced motion
```

The assets are framework-light — React with a router — and the references are written to adapt to Vue, Svelte, or plain JS.

## A note on driver.js internals

Everything in `references/driver-js.md` was checked against the distributed source rather than the README, because the README is stale in places. Two examples that bit during development: the Done button is *not* a separate element (it's the Next button with a `driver-popover-done-btn` class added, so styling it separately is a trap), and re-enabling Back on step 0 destroys the whole tour unless you also supply an `onPrevClick` hook.

## License

MIT
