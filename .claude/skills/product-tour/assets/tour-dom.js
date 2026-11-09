"use client";

// ============================================================================
// TOUR DOM HELPERS
// ============================================================================
// The tour points at real elements on real pages, and those elements are not
// always there when the tour wants them: pages are auth-gated, the calendar is
// an iframe, and half the navbar is display:none below 991px. These helpers
// are what keep a step from spotlighting empty space.
// ============================================================================

// Is this element actually on screen for the user right now?
//
// This is the mobile question. Below 991px the desktop nav links still EXIST in
// the DOM — they're just display:none — so a plain querySelector finds them and
// driver.js would happily draw a spotlight around a 0×0 box in the corner.
// driver.js's own skipMissingElement only covers elements that are absent, not
// elements that are present and invisible, so the check has to happen here.
export function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  return true;
}

// Resolve a selector to a VISIBLE element, or null.
export function findVisible(selector) {
  if (typeof document === "undefined") return null;
  // Take the first match that is genuinely visible rather than the first match
  // outright: several tour targets (the nav links) exist twice, once in the
  // desktop bar and once in the mobile drawer.
  for (const el of document.querySelectorAll(selector)) {
    if (isVisible(el)) return el;
  }
  return null;
}

// Wait for a selector to resolve to a visible element, giving up after
// `timeout`. Pages in this app render their real content only once auth has
// resolved and Firestore has answered, so a tour step arriving a beat early is
// normal, not exceptional — this is the difference between "the tour waits a
// moment" and "the tour points at nothing".
export function waitForVisible(selector, { timeout = 4000, signal } = {}) {
  return new Promise((resolve) => {
    const immediate = findVisible(selector);
    if (immediate) return resolve(immediate);

    let settled = false;
    const finish = (el) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(poll);
      signal?.removeEventListener("abort", onAbort);
      resolve(el);
    };
    const onAbort = () => finish(null);

    // MutationObserver catches the element being added to the DOM...
    const observer = new MutationObserver(() => {
      const el = findVisible(selector);
      if (el) finish(el);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });

    // ...but an element can also become visible through a CSS transition or a
    // media-query change that fires no mutation at all, so poll as well. Cheap
    // at this interval, and it closes the gap the observer alone leaves.
    const poll = setInterval(() => {
      const el = findVisible(selector);
      if (el) finish(el);
    }, 120);

    const timer = setTimeout(() => finish(null), timeout);
    signal?.addEventListener("abort", onAbort);
  });
}

// The breakpoint the navbar collapses at. Steps tagged `only: "desktop"` or
// `only: "mobile"` are counted and shown against this, so the progress
// denominator matches what the member will actually be walked through.
export const MOBILE_QUERY = "(max-width: 991px)";

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

// Compare two app paths ignoring trailing slashes. next.config sets
// trailingSlash: true, so the live URL is "/resources/videos/" while the step
// catalog reads better written as "/resources/videos" — this stops that
// cosmetic difference from being a bug.
export function samePath(a = "", b = "") {
  const norm = (p) => {
    const clean = String(p).split("?")[0].split("#")[0];
    return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
  };
  return norm(a) === norm(b);
}
