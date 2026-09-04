"use client";

import * as React from "react";

/**
 * Focus for the docked inspector.
 *
 * The inspector is **not modal** — it is a layout column, a complementary landmark, and the
 * work beside it stays operable — so it must not trap focus and the background must not go
 * inert. What it still owes a keyboard user is the two ends of the journey: opening it should
 * put you in it, and closing it should put you back where you were. Without the first,
 * activating *Details* moves the eye and not the caret, and reaching the panel means tabbing
 * through the rest of the table; without the second, Escape drops focus onto `<body>` and the
 * next Tab restarts at the top of the page.
 *
 * The design system owns the inspector and is frozen, so this lives here and attaches through
 * the ref the panel already spreads onto its `<aside>`.
 *
 * Only a row activation moves focus. That is not the same as "the panel opened": the list is
 * fetched after mount, so a deep link opens the panel too — a moment later, mid-load, which
 * is the worst possible time to take focus away from someone who is reading. Switching
 * identity does the same, since the data clears and comes back. So the test is not the
 * transition but where focus *is*: a row in the list means somebody activated it, and
 * anything else — `<body>` after a fresh navigation, the identity switcher above the desk —
 * means the panel appeared on its own and should be left where it is.
 */
export function useInspectorFocus(open: boolean): React.RefObject<HTMLElement | null> {
  const panel = React.useRef<HTMLElement | null>(null);
  const invoker = React.useRef<HTMLElement | null>(null);
  const previous = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    const was = previous.current;
    previous.current = open;
    if (was === null || was === open) return;

    if (open) {
      const active = document.activeElement;
      const fromARow = active instanceof HTMLElement && active.closest("table") !== null;
      if (!fromARow) return;
      invoker.current = active;
      // The panel itself, not a control inside it: it is a landmark with a heading, and a
      // screen reader should start reading at the top of what just appeared.
      panel.current?.focus();
      return;
    }

    // `isConnected` because the row that opened the panel may have been re-rendered away —
    // a filter changed, the identity switched. Focusing a detached node silently does
    // nothing and leaves focus on `<body>`, which is the bug this exists to avoid.
    if (invoker.current?.isConnected) invoker.current.focus();
    invoker.current = null;
  }, [open]);

  return panel;
}
