/**
 * The auth surface: a pitch band on one side, the form on the other, and no desk chrome.
 *
 * `SPEC/20-feature-client-ui.md` — *Auth screens are a two-column split: a pitch band in the
 * secondary colour on the left, the form on the right. Login, Register and the forced
 * first-login change carry no sidebar.*
 *
 * Two departures from comp P's markup, both deliberate:
 *
 *  - **The form column comes first in the DOM** and is moved to the right with `order`. Read
 *    in source order the pitch is a page of marketing before the one control on the screen;
 *    read visually it is a band beside it. The screen reader gets the form.
 *  - **The pitch is hidden below `lg`** rather than stacked above the form. On a phone it
 *    would push the sign-in form off the first screen, so the brand mark moves inline
 *    instead and the pitch simply does not run.
 *
 * Every string in the pitch is product copy. The reviewer band, when a screen passes one,
 * sits above the frame — `SPEC/decisions.md` 2026-08-31 keeps the two voices apart.
 */

import { Kbd } from "@collega/design-system";

export interface PitchPoint {
  readonly text: string;
  /** Rendered after the text, for the one point that names a keystroke. */
  readonly keys?: string;
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground ${className ?? ""}`}
    >
      CG
    </span>
  );
}

export function AuthScreen({
  pitchTitle,
  pitchBody,
  pitchPoints = [],
  band,
  children,
}: {
  pitchTitle: string;
  pitchBody: string;
  pitchPoints?: readonly PitchPoint[];
  band?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      {band}
      <div className="grid flex-1 lg:grid-cols-2">
        <main className="flex items-center justify-center px-6 py-10 lg:order-2 lg:px-10">
          <div className="w-full max-w-[26rem]">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <BrandMark />
              <span className="text-base font-semibold tracking-tight">Collega</span>
            </div>
            {children}
          </div>
        </main>

        {/* Every value here is full-strength on the primary ground (4.97:1); the hierarchy
            is size and weight rather than opacity, which is what would take it under 4.5. */}
        <aside className="hidden bg-primary px-10 py-12 text-primary-foreground lg:order-1 lg:flex lg:items-center">
          <div className="ml-auto max-w-[30rem]">
            <span
              aria-hidden="true"
              className="mb-8 flex size-10 items-center justify-center rounded-md border border-primary-foreground/40 text-sm font-bold"
            >
              CG
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">{pitchTitle}</h2>
            <p className="mt-4 mb-0 leading-relaxed">{pitchBody}</p>
            {pitchPoints.length > 0 ? (
              <ul className="mt-8 grid gap-3 p-0">
                {pitchPoints.map((point) => (
                  <li key={point.text} className="flex list-none items-start gap-2.5 text-sm">
                    <Tick />
                    <span>
                      {point.text}
                      {point.keys ? (
                        <>
                          {" "}
                          <Kbd className="border-primary-foreground/40 bg-primary-foreground/15 text-primary-foreground">
                            {point.keys}
                          </Kbd>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
