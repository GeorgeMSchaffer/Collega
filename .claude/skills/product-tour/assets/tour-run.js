"use client";

// ============================================================================
// IN-FLIGHT TOUR POSITION
// ============================================================================
// Where the member has got to *during* a run, mirrored to sessionStorage.
//
// The tour normally moves between pages with router.push(), a client-side
// transition that never unmounts the runner — so React state alone would
// usually be enough. This mirror is for the case that isn't normal: a hard
// reload, a middle-click, a member typing a URL, or a crash. Losing your place
// halfway through onboarding and being dumped back at step one is exactly the
// sort of thing that makes a tour feel broken, so it costs little to survive it.
//
// sessionStorage, not localStorage, and that distinction is the point: an
// abandoned tour should die with the tab. A half-finished run resurrecting
// itself days later would be baffling. If they never finished, tourStatus is
// still "pending" and they simply get a clean run from the top next time.
// ============================================================================

const RUN_KEY = "apptour.run";

export function readRun() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.pageIndex !== "number") return null;
    return { pageIndex: parsed.pageIndex, stepIndex: parsed.stepIndex || 0 };
  } catch {
    return null;
  }
}

export function writeRun(pageIndex, stepIndex) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      RUN_KEY,
      JSON.stringify({ pageIndex, stepIndex })
    );
  } catch {
    // Storage blocked. The run still works for as long as the runner stays
    // mounted, which covers every normal path through the tour.
  }
}

export function clearRun() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RUN_KEY);
  } catch {
    /* nothing to clean up */
  }
}
