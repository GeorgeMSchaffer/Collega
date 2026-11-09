"use client";

// ============================================================================
// THE TOUR ITSELF — what gets highlighted, in what order, and what it says
// ============================================================================
// Steps are grouped by the page they live on. The runner walks the pages in
// order, and inside each page it walks the steps in order, so this array reads
// top-to-bottom exactly the way a member experiences it.
//
// EVERY `element` here is a data-tour="..." attribute placed on a real element
// in a real component. Selecting on a dedicated attribute rather than a class
// name matters: Tailwind class strings get rewritten constantly during design
// work, and a tour that silently stops finding its targets is worse than no
// tour. data-tour attributes have exactly one reason to exist, so nobody
// removes one by accident.
//
// A step whose target isn't visible is dropped at run time rather than here —
// that is what makes this list work unchanged on a phone, where half the
// navbar is display:none. See isVisible() in lib/tour/dom.js.
// ============================================================================

// Any component can open the tour by dispatching this on `window`; the runner
// listens for it. Avoids threading a context through the whole tree just so a
// footer link can say "take the tour".
export const START_TOUR_EVENT = "app:tour:start";

const attr = (id) => `[data-tour="${id}"]`;

export const TOUR_PAGES = [
  {
    path: "/",
    steps: [
      {
        element: attr("welcome-heading"),
        title: "Welcome",
        description:
          "One sentence naming the thing, one giving the reason to care. See references/writing-steps.md.",
        side: "bottom",
        align: "start",
      },
      {
        // Two variants of one idea: only the applicable one renders AND only
        // the applicable one counts toward the progress denominator.
        only: "desktop",
        element: attr("primary-nav"),
        title: "Everything lives up here",
        description: "What is behind the navigation, including anything hidden in a menu.",
        side: "bottom",
        align: "center",
      },
      {
        only: "mobile",
        element: attr("mobile-menu-toggle"),
        title: "Everything lives in here",
        description: "The phone counterpart of the step above.",
        side: "bottom",
        align: "end",
      },
    ],
  },
  {
    path: "/second-page",
    steps: [
      {
        element: attr("some-section"),
        title: "The next thing",
        description: "Keep the whole tour to 10–20 steps.",
        side: "bottom",
        align: "start",
      },
    ],
  },
];

// Does this step apply to the screen the member is on? The desktop nav bar and
// the mobile hamburger are the same step told two ways, and exactly one of them
// runs — so exactly one of them may be COUNTED, or the progress readout skips a
// number at the page boundary ("6 of 18" straight to "8 of 18").
export function appliesToViewport(step, isMobile) {
  if (!step.only) return true;
  return step.only === (isMobile ? "mobile" : "desktop");
}

// Progress is reported across the whole tour ("4 of 17"), not per page, so the
// counter doesn't reset every time the member crosses a page boundary. Counts
// are derived from the catalog rather than hard-coded, so editing a step above
// can't quietly desynchronise the denominator.
export function stepCounts(pageIndex, isMobile = false) {
  const count = (page) =>
    page.steps.filter((s) => appliesToViewport(s, isMobile)).length;
  const total = TOUR_PAGES.reduce((n, p) => n + count(p), 0);
  if (pageIndex === undefined) return { total, before: 0 };
  const before = TOUR_PAGES.slice(0, pageIndex).reduce((n, p) => n + count(p), 0);
  return { total, before };
}
