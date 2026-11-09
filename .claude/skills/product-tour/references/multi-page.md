# Tours that span several pages

## Mount above the routed content

Put the runner in the **root layout**, outside the routed children. Then a
client-side navigation swaps the page underneath it without unmounting the
tour, and the driver instance, the step counter, and any custom overlay all
survive the move.

```jsx
<AuthProvider>
  <Navbar />
  <main>{children}</main>
  <ProductTour />     {/* stays mounted across route changes */}
</AuthProvider>
```

## Navigate with the router, not with links

A plain `<a href>` is a full page load: the runner unmounts and the tour dies
mid-flow. Use the framework's client-side navigation (`router.push` in Next.js)
for the tour's own transitions.

Keep a **sessionStorage mirror** of the position anyway — a hard reload,
middle-click, or crash still happens, and being dumped back at step one is
exactly what makes a tour feel broken.

Use `sessionStorage`, not `localStorage`, deliberately: an abandoned tour
should die with the tab. A half-finished run resurrecting days later is
baffling. If they never finished, the "hasn't seen it" flag is still set and
they get a clean run next time.

## Shape the catalog by page

```js
export const TOUR_PAGES = [
  { path: "/",         steps: [ /* ... */ ] },
  { path: "/library",  steps: [ /* ... */ ] },
  { path: "/",         steps: [ /* closing step */ ] },   // same path twice is fine
];
```

The runner holds `{ pageIndex, stepIndex }`. On each render: if the current
path doesn't match `TOUR_PAGES[pageIndex].path`, navigate there; otherwise wait
for the first target and drive that page's steps.

Normalise paths when comparing — a trailing-slash config difference between
`/library` in the catalog and `/library/` in the URL is a silent mismatch.

## Crossing a boundary

**Forward**: on the last step of a page, advance `pageIndex` and navigate,
rather than calling `moveNext()`.

**Backward**: on step 0 of a page, go to the *previous* page's **last** step.
Pass a deliberately huge index and clamp it when driving
(`Math.min(wanted, steps.length - 1)`), since you can't know that page's
visible-step count until you're there.

Remember driver disables Back on index 0 — see trap 4 in `driver-js.md`.

## Tear-down vs. quitting

Changing pages means destroying and recreating the driver instance. Make sure
that can't be mistaken for the user quitting — otherwise every page transition
records "they skipped it" and the tour ends itself.

With driver.js this is free: the public `destroy()` skips `onDestroyStarted`,
so only a real X/Escape reaches your quit handler. With other libraries, guard
with a flag set around programmatic teardown.

## Progress across pages

Count globally ("4 of 17"), not per page — a counter that resets at every page
boundary tells the user nothing about how much is left. Derive both numbers
from the catalog rather than hard-coding, so editing a step can't desynchronise
the denominator, and exclude steps that won't render on this viewport.

## Adapting to other frameworks

The bundled assets are Next.js App Router, but only three lines are actually
framework-specific. Everything else — the state model, the visibility filters,
the driver.js handling — is plain DOM and portable.

| Next.js App Router | React Router (v6+) | Vue Router | SvelteKit |
|---|---|---|---|
| `usePathname()` | `useLocation().pathname` | `route.path` | `$page.url.pathname` |
| `useRouter().push(p)` | `useNavigate()(p)` | `router.push(p)` | `goto(p)` |
| mount in `app/layout.js` | mount inside `<BrowserRouter>`, outside `<Routes>` | in `App.vue` beside `<router-view>` | in `+layout.svelte` |

The mounting rule is the one that matters and it is the same everywhere: the
runner must live **outside** the part of the tree the router swaps. Inside
`<Routes>`, it unmounts on every navigation and the tour restarts from step
one.

Two Next-specific details to drop when porting:

- `"use client"` — Next-only; harmless to delete elsewhere.
- The trailing-slash normalisation in `samePath()` exists because Next's
  `trailingSlash: true` makes the URL `/library/` while the catalog says
  `/library`. Keep the helper anyway — the same mismatch appears in most
  routers eventually, and it fails silently.

For a **Vite + React Router** app specifically: `import { driver } from "driver.js"`
directly at the top of the file instead of the dynamic `await import()`. The
dynamic import in the asset exists to keep driver.js out of Next's server
prerender; Vite is client-only, so it is unnecessary there.
