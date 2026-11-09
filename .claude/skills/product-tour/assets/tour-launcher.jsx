"use client";

// The "Take the tour" escape hatch. Having this is what lets the auto-start
// rule stay strict — anyone who skipped, or joined before the tour existed,
// still has a way in. Put it somewhere permanent: a Help or More menu.
//
// A DOM event rather than a React context, so any component anywhere can offer
// the tour without the provider being threaded through the tree.

import React from "react";
import { START_TOUR_EVENT } from "@/lib/tour/steps";

export function startTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(START_TOUR_EVENT));
}

export function TourLauncher({ className = "", children = "Take the tour" }) {
  return (
    <button type="button" className={className} onClick={startTour}>
      {children}
    </button>
  );
}
