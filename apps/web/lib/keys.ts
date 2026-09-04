"use client";

import * as React from "react";

/**
 * Make a link answer Space as well as Enter.
 *
 * A row or a card that opens the docked inspector is a link, because the inspector's state
 * lives in the URL and a link is what can be middle-clicked, copied and restored. A link
 * activates on Enter and not on Space — correct for a link, but the thing on screen reads as
 * a card, and Sprint 7.5 recorded people pressing Space at it. So Space activates too, and
 * `preventDefault` stops the page scrolling underneath, which is the half of that bug that
 * survives a naive fix.
 */
export function useActivateOnSpace() {
  return React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== " " || event.currentTarget !== event.target) return;
    event.preventDefault();
    event.currentTarget.click();
  }, []);
}

/**
 * Escape closes the docked inspector.
 *
 * `SPEC/20-feature-client-ui.md` requires it — "Escape closes the column", and for create
 * "Cancel or Escape dismisses without saving" — and Sprint 7.5 recorded Escape being dead on
 * the Blazor drawers. The column is not a modal, so nothing else provides this: the listener
 * is ours.
 *
 * It defers to anything genuinely modal on top of it. A command palette or a select popup
 * open over the column owns Escape first, and closing the column out from under one would
 * dismiss two surfaces with one key.
 */
export function useCloseOnEscape(active: boolean, close: () => void) {
  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"], [role="listbox"]')) return;
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, close]);
}
