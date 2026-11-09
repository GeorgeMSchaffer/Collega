---
name: product-tour
description: >-
  Build a first-run interactive walkthrough that guides new users around an
  app — spotlighted elements, step-by-step tooltips with Next/Back/Skip, an
  optional pointing-hand cursor, and the state logic that makes it appear
  exactly once and never nag again. Use this whenever the user asks for a
  tutorial, product tour, walkthrough, guided tour, onboarding flow, coach
  marks, tooltips that "show you around", a "how it works" overlay, or
  driver.js / Shepherd / Intro.js / Joyride; whenever they describe wanting new
  users to be "shown where to click", "walked through the site", or "taught how
  it works on first login"; and whenever they say people are confused by their
  app, aren't finding features, or need to be introduced to what it offers.
  Also use it when an existing tour needs new steps, restyling, or fixing
  because it re-triggers, breaks on mobile, or loses its place between pages.
---

# Product Tour

A tour is the one piece of UI that interrupts someone on purpose. That buys a
high bar: it has to be short, it has to point at things that are actually
there, and it has to be impossible to trigger twice by accident. Most tours
fail on the third one, and a tour that reappears after you dismissed it is
worse than no tour at all.

The tricky parts are rarely the tooltips. They are:

1. **Who sees it, and exactly once** — the state question, and the one with a
   real product decision inside it.
2. **Surviving navigation** — a tour that spans pages must not lose its place.
3. **Targets that don't exist yet** — auth-gated content, async data, and
   elements that are in the DOM but invisible on a phone.

`driver.js` is the recommended library: ~8KB gzipped for JS + CSS at v1.8, no
dependencies, actively maintained, and it does spotlight + popover + keyboard out of the box. The
patterns below apply to any of them, but the specifics are driver.js 1.8.

## Phase 0 — Settle the policy before writing code

This needs the user, because it's a product decision and the options feel
similar until you say them out loud:

- **Everyone with an account, once** — including people who signed up before
  the tour existed. Best when the app is new or the tour explains something
  people are genuinely missing.
- **New signups only** — existing users are assumed to know the app. Best when
  there's an established user base you don't want to interrupt.

Also settle: **does skipping count as done?** It should. Re-showing a tour
somebody actively dismissed is the behaviour that makes onboarding feel like
nagware. Give them a "Take the tour" entry point instead, somewhere permanent.

Ask, then write it into a comment where the decision lives. Six months later
nobody will remember which of the two was intended.

## Phase 1 — Decide how far the tour travels

**Single page** is dramatically simpler: no navigation, no persistence beyond
"seen it". If everything worth showing is on one screen, stop here.

**Multi-page** is what "show them the whole app" usually means, and it needs
`references/multi-page.md`. The essential idea: mount the tour runner *above*
the routed content (in the root layout), and move between pages with the
router's client-side navigation rather than a full page load. That way the page
swaps underneath the tour without unmounting it, and the tour keeps its place.

Keep it to **10–20 steps**. Past that, people stop reading and start clicking
Next to make it end.

## Phase 2 — Anchor the targets

Add a dedicated attribute to each element the tour points at:

```html
<div data-tour="quick-links"> ... </div>
```

**Select on that, never on class names or DOM structure.** Utility classes get
rewritten constantly during design work and nested structure changes with every
refactor. When a selector breaks, the tour doesn't error — it silently
spotlights nothing, or the wrong thing, and nobody notices until a new user
complains. A `data-tour` attribute has exactly one reason to exist, so nobody
removes one by accident.

Prefer **stable containers** over deeply nested spans, and pick things worth
explaining: what a section is *for*, not what it obviously is.

## Phase 3 — Write steps people will actually read

Keep the catalog as data, grouped by page, so it reads top-to-bottom the way a
user experiences it. See `references/writing-steps.md` for copy guidance. The
short version:

- **Two sentences per step.** Say what it's for and why they'd come back to it.
- **Answer "why do I care", not "what is this".** "Every meeting and deadline
  for the season, kept updated by officers" beats "This is the calendar."
- **Skip the obvious.** A step explaining that a Search box searches is a step
  that teaches people the tour isn't worth reading.
- **Name things the way the app names them**, so the tour and the UI agree.

## Phase 4 — Make it appear exactly once

Use **two stores**, and be clear about what each is for:

- **A server/database flag** on the user record is the source of truth. It
  follows them to another device, so the tour doesn't ambush them again on
  their phone.
- **Local storage** is a same-device cache, read synchronously on load. Without
  it, a returning user sees the tour flash open during the moment before the
  server answers.

The cache is only ever trusted to **suppress** a tour, never to start one — so
a stale cache can only make the tour too quiet, never too noisy.

Key the cache on a **stable per-user identity**, and be careful what that is.
If the app has more than one auth mode (a real backend plus a local/demo mode,
say), an ID that only exists in one of them will make the tour silently never
run in the other. `uid || email` is a reasonable fallback pair.

Include a **tour version** in the stored state. Bumping it re-qualifies
everyone for exactly one more run, which is how a substantially rewritten tour
gets seen.

`assets/tour-state.js` is a working implementation. `references/state-and-triggering.md`
covers the reasoning.

## Phase 5 — Handle targets that aren't there

Two different problems, needing two different filters:

**Not rendered yet.** Auth-gated pages and fetched data arrive a beat after
navigation. Wait for the first target before opening anything — a
MutationObserver plus a short poll, with a timeout. driver.js also has
`waitForElement` per step.

**Rendered but invisible.** Below a mobile breakpoint, desktop nav lives in the
DOM at `display:none`. A plain `querySelector` finds it and the tour cheerfully
spotlights a 0×0 box in the corner. driver.js's `skipMissingElement` covers
*absent* elements, not invisible ones, so check visibility yourself: non-zero
box, plus computed `display`/`visibility`/`opacity`.

For steps that differ by screen size, write **both** and tag them (`desktop` /
`mobile`) — the desktop nav bar and the mobile hamburger are one step told two
ways. If you do this, exclude the non-applicable one from the **progress
denominator** as well as from rendering, or the counter skips a number and
looks broken ("6 of 18" jumping to "8 of 18").

The viewport case can be predicted, so fix it properly. The *visibility* case
cannot — you can't know whether a section on page 4 will render empty until you
get there — so the denominator is a best estimate. Clamp the numerator so it
can never exceed it, and accept that a genuinely missing target may skip a
number rather than pretending otherwise.

## Phase 6 — Style it like the app, not like the library

Every tour library ships deliberately plain styling. Restyle it or the tour
looks bolted on:

- Scope everything under a custom popover class so nothing leaks.
- Use the app's real design tokens — font, radius, button shape, shadow.
- **Handle dark mode**, including the popover arrow, which is usually a CSS
  border triangle whose visible side differs per placement.
- A subtle entrance transform reads as the tour *moving*; a plain fade reads as
  two popovers cross-dissolving.
- Respect `prefers-reduced-motion`.

`assets/tour-theme.css` is a themed starting point. driver.js's exact class
names and the arrow trap are in `references/driver-js.md`.

## Phase 7 — The guiding hand (optional but effective)

The tutorial-video affordance: a hand or pointer that taps whatever is
spotlighted, so "this button here" has something pointing at it. Worth it for
consumer or student-facing apps; usually wrong for dense internal tools.

Three things make it work rather than annoy:

- **Track the target on an animation frame**, not on scroll events. Tour
  libraries smooth-scroll to each step, and an event-driven listener visibly
  lags behind that animation.
- **`pointer-events: none` everywhere**, so it can never eat a click.
- **Sit above the dimming overlay but below the popover**, so the hand never
  covers the words being read.

`assets/hand-cursor.jsx` is a working React implementation.

## Phase 8 — Test it properly

Walk the whole thing, in both themes and at a phone width. Specifically check:

- Auto-start fires for the intended audience, and **not** for anyone else —
  including signed-out visitors, who should get nothing at all.
- **It does not come back** after finishing, and after skipping.
- Forward *and* **backward across page boundaries**. Backward is the one that
  breaks; see the disabled-button trap in `references/driver-js.md`.
- Every exit — X, Escape, Skip — records state and leaves no overlay, no
  scroll-lock, and no leftover classes on `<body>`.
- The progress counter never skips a number.

**The testing trap that wastes the most time:** tour libraries animate on
`requestAnimationFrame`, which browsers throttle in background tabs. Test in a
*focused* tab. Otherwise the transition never completes, the popover never
advances, hooks like `onHighlighted` never fire, and it all looks exactly like
a bug in your code.

## Traps

**Selecting on class names.** Silent breakage, months later.

**Trusting `skipMissingElement` for `display:none`.** It only covers absent
elements.

**Letting the tour re-trigger.** The failure that makes people hate tours.
Cache must be written before any navigation the final step performs.

**Counting steps you don't show.** The progress denominator has to match what
actually renders.

**A guard set before an async gap, with a cleanup that can fire during it.**
The auto-start delay is the usual victim — see `references/state-and-triggering.md`.
It disables the whole feature and logs nothing.

**A hand or overlay that intercepts clicks.**

**Testing in a background tab.**

## Reference files

- `references/driver-js.md` — driver.js 1.8 API traps, all verified against the
  distributed source: hooks that replace default behaviour, the two destroy
  paths, the done-button class, disabled buttons, arrow colouring, z-index.
- `references/multi-page.md` — spanning pages without losing position.
- `references/state-and-triggering.md` — the two-store model and who sees it.
- `references/writing-steps.md` — copy that gets read.
- `assets/` — working implementations: `tour-state.js`, `product-tour.jsx`,
  `hand-cursor.jsx`, `tour-theme.css`. React/Next, adaptable elsewhere.
