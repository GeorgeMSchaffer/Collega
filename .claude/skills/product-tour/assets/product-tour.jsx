// ---------------------------------------------------------------------------
// ADAPT — this file needs five siblings and one hook:
//   @/lib/tour/steps            -> TOUR_PAGES, START_TOUR_EVENT,
//                                  appliesToViewport, stepCounts   (tour-steps.js)
//   @/lib/tour/state            -> shouldAutoStart, markTourCompleted,
//                                  markTourSkipped                 (tour-state.js)
//   @/lib/tour/run              -> readRun, writeRun, clearRun     (tour-run.js)
//   @/lib/tour/dom              -> findVisible, isMobileViewport,
//                                  samePath, waitForVisible        (tour-dom.js)
//   @/components/tour/hand-cursor -> HandCursor                    (hand-cursor.jsx)
//   an auth hook exposing { user, ready }
//
// ALSO: import tour-theme.css from your global stylesheet. This file only
// imports driver.js's own CSS; the popoverClass set below ("apptour-popover")
// has no styling at all without the theme file, and the tour will render as
// unstyled white boxes.
//
// NOT USING THE GUIDING HAND? Delete the HandCursor import and the
// <HandCursor/> at the bottom, and drop the .apptour-hand half of the theme.
// Phase 7 of SKILL.md explains when it is and isn't worth having.
//
// FRAMEWORK: written for Next.js App Router. For React Router / Vue / Svelte,
// swap usePathname + useRouter().push per the table in references/multi-page.md
// and delete the "use client" line.
// ---------------------------------------------------------------------------
"use client";

// ============================================================================
// PRODUCT TOUR RUNNER
// ============================================================================
// Drives the first-run walkthrough across several pages using driver.js.
//
// It is mounted once, in the root layout, and stays mounted for the whole
// session. That placement is what makes a multi-page tour feel like one
// continuous thing: because the runner lives ABOVE {children}, a client-side
// router.push() swaps the page underneath it without unmounting the tour, so
// the driver instance, the step counter and the hand cursor all survive the
// move. (A plain <a href> would hard-reload and lose all of it — hence
// router.push here, and the sessionStorage mirror in lib/tour/run.js as the
// safety net for reloads we don't control.)
//
// WHO SEES IT: everyone with an account, exactly once — new signups and the
// members who were already here alike. See lib/tour/state.js; that file owns
// the whole decision.
// ============================================================================

import "driver.js/dist/driver.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth"; // ADAPT: your auth hook — needs { user, ready }
import {
  TOUR_PAGES,
  START_TOUR_EVENT,
  appliesToViewport,
  stepCounts,
} from "@/lib/tour/steps";
import {
  markTourCompleted,
  markTourSkipped,
  shouldAutoStart,
} from "@/lib/tour/state";
import { clearRun, readRun, writeRun } from "@/lib/tour/run";
import {
  findVisible,
  isMobileViewport,
  samePath,
  waitForVisible,
} from "@/lib/tour/dom";
import { HandCursor } from "@/components/tour/hand-cursor";

export function ProductTour() {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState({ pageIndex: 0, stepIndex: 0 });
  // The element the spotlight is currently on, so the hand can point at it.
  const [target, setTarget] = useState(null);

  const driverRef = useRef(null);
  // Belt and braces. driver.js 1.8's public destroy() calls its internal
  // destroy(false), which SKIPS onDestroyStarted entirely — only the X button
  // and Escape fire that hook — so our own teardown can't be mistaken for the
  // member quitting. Kept because that guarantee is an implementation detail
  // of one version, and the cost of being wrong is recording every page
  // transition as "they skipped it".
  const teardownRef = useRef(false);
  // Guards the auto-start so it can only ever fire once per mount, even though
  // the auth object changes identity on every profile refresh.
  const autoStartedRef = useRef(false);
  const positionRef = useRef(position);
  positionRef.current = position;
  const autoStartTimer = useRef(null);

  // --- lifecycle -----------------------------------------------------------

  const teardownDriver = useCallback(() => {
    if (!driverRef.current) return;
    teardownRef.current = true;
    try {
      driverRef.current.destroy();
    } catch {
      /* already gone */
    }
    driverRef.current = null;
    teardownRef.current = false;
    setTarget(null);
  }, []);

  const finish = useCallback(
    (outcome) => {
      teardownDriver();
      setRunning(false);
      setTarget(null);
      clearRun();
      if (outcome === "completed") markTourCompleted(user);
      else markTourSkipped(user);
    },
    [teardownDriver, user]
  );

  const start = useCallback(
    (pageIndex = 0, stepIndex = 0) => {
      setPosition({ pageIndex, stepIndex });
      writeRun(pageIndex, stepIndex);
      setRunning(true);
    },
    []
  );

  // --- triggers ------------------------------------------------------------

  // Auto-start: a brand-new signup, and nobody else.
  useEffect(() => {
    if (!ready || autoStartedRef.current) return;
    const resumable = readRun();
    if (resumable && user) {
      // A run was already in flight in this tab (hard reload mid-tour).
      autoStartedRef.current = true;
      start(resumable.pageIndex, resumable.stepIndex);
      return;
    }
    if (shouldAutoStart(user)) {
      autoStartedRef.current = true;
      // One frame of breathing room so the member sees the page they just
      // landed on before it dims — opening the tour mid-paint reads as a
      // glitch rather than a welcome.
      //
      // Deliberately NOT cleaned up by this effect. `user` gets a new object
      // identity whenever the profile refreshes, and if that happens inside
      // this 600ms window an effect-scoped cleanup would clear the timer while
      // autoStartedRef already reads "started" — so the tour would never run,
      // for anyone, with nothing in the console to say why. Cleared on unmount
      // instead, below.
      autoStartTimer.current = setTimeout(() => start(0, 0), 600);
    }
  }, [ready, user, start]);

  useEffect(() => () => clearTimeout(autoStartTimer.current), []);

  // Manual start, from the "Take the tour" links. A DOM event rather than a
  // context so any component anywhere can offer the tour without the provider
  // having to be threaded through it.
  useEffect(() => {
    const onStart = () => start(0, 0);
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [start]);

  // --- navigation between tour pages ---------------------------------------

  const goToPage = useCallback(
    (pageIndex, stepIndex) => {
      const page = TOUR_PAGES[pageIndex];
      if (!page) return;
      teardownDriver();
      setPosition({ pageIndex, stepIndex });
      writeRun(pageIndex, stepIndex);
      if (!samePath(pathname, page.path)) router.push(page.path);
    },
    [pathname, router, teardownDriver]
  );

  // --- the drive ------------------------------------------------------------

  useEffect(() => {
    if (!running) return;
    const page = TOUR_PAGES[position.pageIndex];
    if (!page) return;

    // Wrong page for this step — send them there and let the effect re-run.
    if (!samePath(pathname, page.path)) {
      router.push(page.path);
      return;
    }

    let cancelled = false;
    const abort = new AbortController();

    (async () => {
      const { driver } = await import("driver.js");
      if (cancelled) return;

      // Wait for the page's first target before opening anything. These pages
      // gate on auth and then on Firestore, so the content genuinely isn't
      // there yet for the first few hundred milliseconds after a transition.
      await waitForVisible(page.steps[0].element, {
        timeout: 6000,
        signal: abort.signal,
      });
      if (cancelled) return;

      // Two filters, in this order and for different reasons.
      //  1. VIEWPORT — drops the desktop/mobile variant that doesn't apply.
      //     This one also drives the progress denominator below, so the two
      //     always agree and the counter can't skip a number at a page break.
      //  2. VISIBLE — the safety net for everything else: a section that
      //     rendered empty, an officer-only control, a target that never
      //     arrived. Nothing here can be predicted from the catalog.
      const isMobile = isMobileViewport();
      const steps = page.steps
        .filter((s) => appliesToViewport(s, isMobile))
        .filter((s) => findVisible(s.element));
      if (!steps.length) {
        // Nothing to show here (very narrow screen, or an officer-only page a
        // student reached). Skip the page rather than stalling on it.
        const next = position.pageIndex + 1;
        if (next < TOUR_PAGES.length) goToPage(next, 0);
        else finish("completed");
        return;
      }

      const isLastPage = position.pageIndex === TOUR_PAGES.length - 1;
      const { before, total } = stepCounts(position.pageIndex, isMobile);
      const startAt = Math.min(position.stepIndex, steps.length - 1);

      const d = driver({
        // Motion + spotlight
        animate: true,
        smoothScroll: true,
        overlayColor: "#150c22",
        overlayOpacity: 0.62,
        stagePadding: 8,
        stageRadius: 14,
        popoverOffset: 14,
        // Keep the member on the rails: clicking the highlighted element would
        // navigate away mid-tour and strand them. The tour does the moving.
        disableActiveInteraction: true,
        allowClose: true,
        allowKeyboardControl: true,
        popoverClass: "apptour-popover",
        showProgress: false, // replaced by our own global counter, below
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: isLastPage ? "Finish" : "Next",

        steps: steps.map((s) => ({
          element: s.element,
          popover: {
            title: s.title,
            description: s.description,
            side: s.side || "bottom",
            align: s.align || "start",
          },
        })),

        // Progress is counted across the WHOLE tour, not per page, so "3 of 18"
        // keeps meaning the same thing after a page change.
        onPopoverRender: (popover, { state }) => {
          const current = before + (state.activeIndex ?? 0) + 1;
          // Clamp so a step dropped by filter 2 above can never produce the
          // nonsense "18 of 17" — better to hold at the last number than to
          // overshoot the total the member was promised.
          const shown = Math.max(total, current);
          const meta = document.createElement("div");
          meta.className = "apptour-progress";
          meta.textContent = `${current} of ${shown}`;
          popover.title.parentElement?.insertBefore(meta, popover.title);

          const skip = document.createElement("button");
          skip.type = "button";
          skip.className = "apptour-skip";
          skip.textContent = "Skip tour";
          skip.addEventListener("click", () => finish("skipped"));
          popover.footer?.prepend(skip);

          // driver.js greys out Back whenever it is on step 0 of the array it
          // was handed — but that array is only THIS page's steps, so on every
          // page after the first, "step 0" is the middle of the tour, not the
          // start of it. Left alone, the tour would move forward across pages
          // and refuse to move back. onPrevClick already knows how to walk to
          // the previous page, so the button just needs re-enabling.
          if ((state.activeIndex ?? 0) === 0 && position.pageIndex > 0) {
            // Both halves are required: driver.js sets the DOM `disabled`
            // property as well as the class, and a disabled <button> fires no
            // click event at all, so clearing only the styling would leave a
            // button that looks alive and does nothing.
            if (popover.previousButton) {
              popover.previousButton.disabled = false;
              popover.previousButton.classList.remove("driver-popover-btn-disabled");
            }
          }
        },

        onHighlighted: (element) => setTarget(element || null),
        onDeselected: () => setTarget(null),

        // Every one of these hooks REPLACES driver.js's built-in behaviour —
        // verified in driver.js 1.8.0's source, where the popover click
        // handler returns config.onNextClick?.() instead of advancing. So each
        // one has to do the moving itself.
        onNextClick: () => {
          const d2 = driverRef.current;
          if (!d2) return;
          if (d2.isLastStep()) {
            const next = position.pageIndex + 1;
            if (next < TOUR_PAGES.length) goToPage(next, 0);
            else finish("completed");
            return;
          }
          const idx = (d2.getActiveIndex() ?? 0) + 1;
          setPosition((p) => ({ ...p, stepIndex: idx }));
          writeRun(position.pageIndex, idx);
          d2.moveNext();
        },
        onPrevClick: () => {
          const d2 = driverRef.current;
          if (!d2) return;
          if (d2.isFirstStep()) {
            const prev = position.pageIndex - 1;
            // -1 means "the last step of that page"; the drive effect clamps it.
            if (prev >= 0) goToPage(prev, Number.MAX_SAFE_INTEGER);
            return;
          }
          const idx = Math.max(0, (d2.getActiveIndex() ?? 0) - 1);
          setPosition((p) => ({ ...p, stepIndex: idx }));
          writeRun(position.pageIndex, idx);
          d2.movePrevious();
        },
        onCloseClick: () => finish("skipped"),
        // Fires for the X button and Escape only — the public destroy() we
        // call ourselves bypasses this hook (see teardownRef above).
        onDestroyStarted: () => {
          if (teardownRef.current) {
            driverRef.current?.destroy();
            return;
          }
          finish("skipped");
        },
      });

      driverRef.current = d;
      d.drive(startAt);
    })();

    return () => {
      cancelled = true;
      abort.abort();
      teardownDriver();
    };
    // position.stepIndex is deliberately absent: driver.js owns the within-page
    // index once it is driving, and re-running this effect on every Next click
    // would tear the popover down and rebuild it mid-animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, position.pageIndex, pathname, router, goToPage, finish, teardownDriver]);

  // Signing out mid-tour should close it, not leave a spotlight on a logged-out
  // page.
  useEffect(() => {
    if (running && ready && !user) {
      teardownDriver();
      setRunning(false);
      clearRun();
    }
  }, [running, ready, user, teardownDriver]);

  if (!running) return null;
  return <HandCursor target={target} />;
}
