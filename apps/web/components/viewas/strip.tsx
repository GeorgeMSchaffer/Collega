"use client";

/**
 * The identity strip: the first thing in the work column on every desk screen.
 *
 * It is one strip carrying two states because the two are the same subject and are never
 * both true. With no session it is the right-aligned `View as…` control the comp puts in the
 * page header (D-PLACE, entry point one of two — the other is the rail item in
 * `components/nav/nav-items.tsx`). With a session live it is the banner rule 22 requires:
 * persistent, non-dismissable, naming both identities, one click to exit.
 *
 * **The banner never says "a session is live" with colour.** Sprint 7.5 found meaning carried
 * by background alone more than once, and this banner is the worst possible place for it — an
 * administrator who does not notice it will attribute work to the wrong person. So the amber
 * sits under an eye mark, the words *Viewing as*, both names spelled out, and an exit control.
 * Remove the colour and every one of those still reads.
 *
 * Rule 4 says every identity field reports the target; the banner is the one place the real
 * administrator appears at all.
 */

import { Alert, AlertDescription, AlertTitle, Button, DeniedAction, ForRoles } from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { EyeIcon } from "@/components/viewas/eye-icon";
import { MAY_VIEW_AS, impersonatedName, personName, useViewAs } from "@/components/viewas/session";
import { viewingAsOf } from "@/components/viewas/types";
import { ROLE_LABELS } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

/** The `View as…` control itself, so both entry points render the same thing. */
export function ViewAsTrigger({ className }: { className?: string }) {
  const { openPicker, session } = useViewAs();
  const ref = React.useRef<HTMLButtonElement>(null);

  // Rule 5, said out loud rather than by a control that silently does nothing. `DeniedAction`
  // keeps the tab stop and reads the reason out on focus.
  if (session) {
    return (
      <DeniedAction reason="Sessions do not nest — exit first." className={className}>
        {(denied) => (
          <Button variant="outline" {...denied}>
            <EyeIcon />
            View as…
          </Button>
        )}
      </DeniedAction>
    );
  }

  return (
    <Button
      ref={ref}
      variant="outline"
      className={className}
      data-testid="view-as-trigger"
      onClick={() => openPicker(ref.current)}
    >
      <EyeIcon />
      View as…
    </Button>
  );
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function Banner() {
  const { session, end, ending, error, pendingBannerFocusRef } = useViewAs();
  const { me } = useWorkspace();
  const exitRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    // Starting a session remounts the whole work column, so this is where focus has to be
    // picked back up; see `pendingBannerFocusRef`. Only when a start put it there — a reload
    // must not steal focus from wherever the reader left it.
    if (!pendingBannerFocusRef.current) return;
    pendingBannerFocusRef.current = false;
    exitRef.current?.focus();
  }, [pendingBannerFocusRef]);

  if (!session) return null;

  const sameUser = me?.userId === session.impersonating.userId;
  const target = sameUser && me ? me : session.impersonating;
  const targetName = impersonatedName(session, me);

  // Prefer what the server reports over what was remembered. Today the corpus never fills
  // `viewingAs` in, so these fall back to the start response every time; the day Nest answers
  // it, the banner is server-driven with no other change.
  const reported = viewingAsOf(me);
  const actorName = reported?.realUserName ?? personName(session.realUser);
  const expiresAt = new Date(reported?.expiresAtUtc ?? session.expiresAtUtc);

  return (
    <div data-testid="view-as-banner">
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-white md:px-6"
        style={{ backgroundColor: "var(--orange-deep)" }}
      >
        <EyeIcon className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm leading-tight">
            <strong className="font-bold">Viewing as {targetName}</strong>
            <span> — {ROLE_LABELS[target.role]}</span>
          </p>
          <p className="m-0 mt-0.5 text-xs leading-snug">
            You&rsquo;re seeing exactly what they see. Anything you do is recorded as{" "}
            <strong className="font-bold">{actorName}</strong> acting as them. Ends by{" "}
            {TIME.format(expiresAt)} at the latest.
          </p>
        </div>
        <Button
          ref={exitRef}
          variant="secondary"
          // No tint on hover: every shade of white-on-amber this could use falls under 4.5:1,
          // so the affordance is a ring and the label keeps its contrast.
          className="shrink-0 bg-white font-bold hover:bg-white hover:ring-2 hover:ring-white"
          style={{ color: "var(--orange-deep)" }}
          onClick={() => void end()}
          disabled={ending}
          data-testid="view-as-exit"
        >
          {ending ? "Exiting…" : "Exit view-as"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="m-4 w-auto md:m-6">
          <AlertTitle>{error.problem?.title ?? "The session could not be ended"}</AlertTitle>
          <AlertDescription>
            {error.problem?.detail ?? "Nothing has changed. You are still viewing as this user."}
          </AlertDescription>
        </Alert>
      ) : null}

      <CorpusNote className="m-4 md:m-6">
        {session.requestedUserId !== session.impersonating.userId ? (
          <>
            you asked to view as <strong>{session.requestedName}</strong> and the API answered with the one
            recorded session — <strong>{personName(session.impersonating)}</strong>. The mock matches on
            method, path and identity, never on the request body, so it cannot tell the two requests apart.
            The banner names the server&rsquo;s answer, because the server is what decides.{" "}
          </>
        ) : null}
        {!sameUser && me ? (
          <>
            the screens below are answering as the corpus&rsquo;s recorded {ROLE_LABELS[me.role]} ({me.email}
            ), not as {targetName}.{" "}
          </>
        ) : null}
        no recording carries <code>viewingAs</code>, so this banner is held by the browser rather than
        reported by the server.
      </CorpusNote>
    </div>
  );
}

export function ViewAsStrip() {
  const { session } = useViewAs();

  if (session) return <Banner />;

  return (
    <ForRoles roles={MAY_VIEW_AS}>
      {/* No rule of its own above the top bar: the control reads as the page's, which is
          where the comp puts it, rather than as a band of chrome in its own right. */}
      <div className="flex items-center justify-end bg-background px-4 pt-3 md:px-6">
        <ViewAsTrigger />
      </div>
    </ForRoles>
  );
}
