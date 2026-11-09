"use client";

// ============================================================================
// TOUR — GUIDING HAND CURSOR
// ============================================================================
// The tutorial-video affordance: a small hand that hovers over whatever
// driver.js is spotlighting and taps it, so a member reads the popover AND
// sees where the popover is pointing without having to trace the outline.
//
// Three deliberate constraints shape the implementation:
//
// 1. IT NEVER TAKES A CLICK. `pointer-events: none` on the root, inherited by
//    everything inside it. It sits on top of the page, including on top of the
//    element the member may be trying to look at, so it has to be inert.
//
// 2. IT IS CSS, NOT JS. The bob, the ripple and the dot are keyframes (see
//    globals.css, `apptour-hand-*`). Nothing about the animation depends on React
//    re-rendering, so a step that changes three times in 200ms — which happens
//    when a page mounts and driver.js re-highlights — can't strand a half-
//    finished spring mid-air. motion/react is in the bundle and would have
//    been fine for a single, stable element; it is the wrong trade for one
//    that moves whenever the spotlight does.
//
// 3. IT FOLLOWS THE BOX IMPERATIVELY. Position is written straight to
//    `style.transform` from a rAF loop rather than held in state. driver.js
//    smooth-scrolls AND animates its stage between steps, so the target's rect
//    changes every frame for a few hundred ms; a setState per frame would
//    re-render the tour on every one of them for no benefit.
//
// Z-ORDER (driver.js 1.8.0, verified in node_modules/driver.js/dist):
//   overlay SVG ....... z-index 10000  (inline style, in the built JS)
//   popover ........... z-index 1000000000  (driver.css)
// So 10001 is the useful slot: above the dimming overlay and the spotlight
// cutout, still below the popover — the hand must never cover the copy the
// member is reading. The site navbar's z-[999] is far below both.
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Static export prerenders this tree, and useLayoutEffect warns on the server.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// --- glyphs ---------------------------------------------------------------
// Both are drawn in a 44×58 box with the POINTING END at (9, 9), because every
// transform in the stylesheet — the mirror, the 180° flip, the tap bob — is
// anchored on that point. Move it and the hand stops touching its own ripple.

// A right hand, index finger extended, thumb tucked along the side. Drawn
// upright and then rotated -20° about the fingertip so it reads as reaching in
// from the lower right rather than standing on the page like a signpost.
const HAND_PATH =
  "M3.5 14 A5.5 5.5 0 0 1 14.5 14 L14.5 26.5 C18.5 24.8 25 26.8 25 34 " +
  "L25 40.5 C25 46.2 21.2 50 15.5 50 L9.5 50 C4 50 0 47 -1.6 42.6 " +
  "C-3.4 38.4 -4.2 34.6 -1.8 33.1 C0 31.9 1.6 32.8 2.1 34.8 " +
  "C2.6 31.8 3.1 28.6 3.5 26 Z";

// The alternative: a plain arrow cursor. Already tilted by its own geometry,
// so it is NOT wrapped in the rotation the hand needs.
const POINTER_PATH =
  "M9 9 L9 45 L17.6 36.8 L22.8 49.2 L28 47 L23 34.8 L33.9 33.2 Z";

// How much room the glyph needs past the anchor, as a multiple of `size`.
// The hand hangs down and out from the fingertip; these are its extents.
const REACH_X = 0.95;
const REACH_Y = 1.25;

/**
 * Where should the hand sit for this target, and which way should it face?
 * Returns null when the target has scrolled out of view — the caller hides.
 */
function placement(target, size, margin) {
  if (!target || !target.isConnected) return null;

  const rect = target.getBoundingClientRect();
  // clientWidth/Height rather than innerWidth/Height: fixed elements are laid
  // out inside the scrollbar, and pointing 15px off is visible at this size.
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Work with the part of the box that is actually on screen, so a tall card
  // scrolled half out of view gets tapped where the member can see it.
  const left = Math.max(rect.left, margin);
  const top = Math.max(rect.top, margin);
  const right = Math.min(rect.right, vw - margin);
  const bottom = Math.min(rect.bottom, vh - margin);
  if (right - left < 2 || bottom - top < 2) return null;

  // Centre of that visible box — but capped. Dead-centre is right for a button
  // and wrong for a 600px section, where the middle is usually whitespace and
  // the thing worth pointing at is near the top. The caps are no-ops for
  // anything small enough that its centre IS the interesting part.
  const x = left + Math.min((right - left) / 2, 200);
  const y = top + Math.min((bottom - top) / 2, 88);

  // Which way the hand reaches. Three orientations, because those are the ones
  // a hand can hold without looking wrong: "br" as drawn, "bl" mirrored, "tl"
  // rotated a full 180°. The fourth corner would need scaleY(-1), which bends
  // the fingers backwards, so it is deliberately absent.
  const reachX = size * REACH_X;
  const reachY = size * REACH_Y;
  const fitsBR = Math.min((vw - x) / reachX, (vh - y) / reachY);
  const fitsBL = Math.min(x / reachX, (vh - y) / reachY);
  const fitsTL = Math.min(x / reachX, y / reachY);

  let mode = "br";
  if (fitsBR < 1) {
    if (fitsBL >= 1) mode = "bl";
    else if (fitsTL >= 1) mode = "tl";
    else mode = fitsBL >= fitsTL ? "bl" : "tl";
  }

  // Whole pixels: the rect is fractional and driver.js scrolls smoothly, so
  // rounding is what stops the ring shimmering as it travels.
  return { x: Math.round(x), y: Math.round(y), mode };
}

/**
 * @param {Object}  props
 * @param {Element|null} props.target  Element the tour is highlighting.
 * @param {"hand"|"pointer"} [props.glyph]
 * @param {number}  [props.size]    Glyph width in px (ring and dot scale with it).
 * @param {number}  [props.margin]  Keep the tap point this far inside the viewport.
 * @param {number}  [props.zIndex]
 * @param {string}  [props.className]
 */
export function HandCursor({
  target,
  glyph = "hand",
  size = 48,
  margin = 12,
  zIndex = 10001,
  className = "",
}) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (!target || typeof target.getBoundingClientRect !== "function") {
      root.dataset.visible = "false";
      return;
    }

    // Replay the entrance on every new target: without this the hand would
    // teleport between steps, which reads as a rendering glitch rather than as
    // something moving to the next thing.
    const stage = stageRef.current;
    if (stage) {
      stage.style.animation = "none";
      void stage.offsetWidth; // force reflow so the restart takes
      stage.style.animation = "";
    }

    // One rAF loop instead of scroll + resize + ResizeObserver + IntersectionObserver.
    // Those four together still miss the cases that matter here: driver.js's
    // own stage animation, a CSS transition on the target, and a scrolling
    // ancestor that isn't the window. A getBoundingClientRect per frame is
    // cheap, the loop parks itself when the tab is hidden, and it writes to the
    // DOM only when the rounded position actually changed.
    let frame = 0;
    let last = "";

    const tick = () => {
      const next = placement(target, size, margin);
      if (!next) {
        if (last !== "hidden") {
          root.dataset.visible = "false";
          last = "hidden";
        }
      } else {
        const key = `${next.x}|${next.y}|${next.mode}`;
        if (key !== last) {
          last = key;
          root.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
          root.dataset.mode = next.mode;
          root.dataset.visible = "true";
        }
      }
      frame = requestAnimationFrame(tick);
    };

    tick(); // place it this frame, don't wait for the next one
    return () => cancelAnimationFrame(frame);
  }, [target, size, margin, mounted]);

  if (!mounted) return null;

  const path = glyph === "pointer" ? POINTER_PATH : HAND_PATH;
  const shape = <path d={path} />;

  return createPortal(
    <div
      ref={rootRef}
      className={`apptour-hand${className ? ` ${className}` : ""}`}
      style={{ "--apptour-hand-size": `${size}px`, "--apptour-hand-z": zIndex }}
      data-mode="br"
      data-visible="false"
      data-glyph={glyph}
      aria-hidden="true"
      role="presentation"
    >
      <div ref={stageRef} className="apptour-hand__stage">
        <span className="apptour-hand__ring" />
        <span className="apptour-hand__ring apptour-hand__ring--late" />
        <span className="apptour-hand__dot" />
        <span className="apptour-hand__glyph">
          <svg
            className="apptour-hand__svg"
            viewBox="0 0 44 58"
            fill="none"
            focusable="false"
            aria-hidden="true"
          >
            <g
              fill="var(--apptour-hand-fill)"
              stroke="var(--apptour-hand-stroke)"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {glyph === "pointer" ? (
                shape
              ) : (
                // Pivot is the fingertip, so the tilt doesn't move the point
                // the whole component is aligned to.
                <g transform="rotate(-20 9 9)">{shape}</g>
              )}
            </g>
          </svg>
        </span>
      </div>
    </div>,
    document.body
  );
}

export default HandCursor;
