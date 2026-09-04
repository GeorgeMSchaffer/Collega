"use client";

/**
 * The View As screen — where the rail entry point lands.
 *
 * D-PLACE locks two entry points, and Sprint 6.5 exists because only one was built and the
 * feature could not be found. The second one is the rail item, and the design system carries
 * no menu primitive to hang an avatar menu off (no `DropdownMenu`, no `Popover`), so the rail
 * item is a route rather than a menu entry. That turns out to be worth having on its own
 * terms: the feature gets an address that can be linked to and returned to, and the rules
 * about who may act as whom have somewhere to be written down where an administrator will
 * actually meet them.
 *
 * Opening the screen opens the picker, so the rail entry is still one click. Closing the
 * picker leaves the screen standing with the control that reopens it.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote, LoadingRows, RefusalNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { EyeIcon } from "@/components/viewas/eye-icon";
import { MAY_VIEW_AS, impersonatedName, useViewAs } from "@/components/viewas/session";
import type { ViewAsCandidate } from "@/components/viewas/types";
import { useApi } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

const SCOPE_ROWS = [
  ["Site Admin", "Any active user in any organization. Other Site Admins are never listed."],
  ["Org Admin", "Active users of their own organization only. No cross-organization access."],
  ["Member and Read Only", "Nobody. The server refuses the request, whatever the screen shows."],
] as const;

export function ViewAsScreen() {
  const { me, meError } = useWorkspace();
  const { openPicker, session, claimAutoOpen } = useViewAs();
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const mayViewAs = me ? MAY_VIEW_AS.includes(me.role) : false;

  // The refusal is worth showing rather than hiding the screen: rule 8 is that the control
  // carries no authority, and the API's own words are the honest answer to "why not".
  //
  // Not while a session is live, though. Acting as a Member makes this endpoint a refusal —
  // correctly, that is the target's own role answering — but the reason the picker is shut is
  // rule 5, and stacking the two says one thing twice and neither clearly.
  const candidates = useApi<ViewAsCandidate[]>(
    me && !mayViewAs && !session ? "/auth/view-as/candidates" : null,
  );

  React.useEffect(() => {
    // Once per arrival, and the claim is held above the shell: exiting a session re-keys the
    // work column, so a flag kept here would reset and slide the drawer back open over the
    // exit the reader just asked for.
    //
    // The claim is taken as soon as the identity is known, before deciding whether to open —
    // arriving here mid-session is still an arrival, and leaving it unclaimed is what made
    // the exit re-open the drawer.
    if (!me || !claimAutoOpen("/view-as")) return;
    if (mayViewAs && !session) openPicker(triggerRef.current);
  }, [me, mayViewAs, session, openPicker, claimAutoOpen]);

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Configure" }, { label: "View as" }]} />
      <DeskWork>
        <PageHeader title="View as another user">
          Act in Collega as one of your users — same role, same organization scope, same visible data — to
          reproduce an issue, check a permission, or create content on their behalf.
        </PageHeader>

        {!me && !meError ? <LoadingRows rows={3} /> : null}

        {session ? (
          <Alert variant="warning" className="mb-6">
            <AlertTitle>You are viewing as {impersonatedName(session, me)}</AlertTitle>
            <AlertDescription>
              Sessions do not nest. Exit the one in the banner above before starting another.
            </AlertDescription>
          </Alert>
        ) : null}

        {mayViewAs && !session ? (
          <button
            ref={triggerRef}
            type="button"
            className="mb-6 inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold shadow-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => openPicker(triggerRef.current)}
          >
            <EyeIcon />
            Choose a user…
          </button>
        ) : null}

        {candidates.error?.isRefusal ? (
          <RefusalNotice error={candidates.error} what="View as" className="mb-6" />
        ) : null}

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Your role</TableHead>
                <TableHead>Who you can act as</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCOPE_ROWS.map(([role, scope]) => (
                <TableRow key={role}>
                  <TableCell className="font-semibold whitespace-nowrap">{role}</TableCell>
                  <TableCell>{scope}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          Starting and ending a session are always recorded, and every change made during one carries both
          names: the content belongs to the user you are acting as, and you are recorded alongside it. A
          session ends by itself after 30 minutes idle, or two hours from the start.
        </p>

        <CorpusNote className="mt-6 max-w-2xl">
          the server is meant to report a live session on <code>GET /auth/me</code>, as <code>viewingAs</code>
          , so that one which has expired or been ended cannot leave a banner behind. Every recording in the
          corpus has that field <code>null</code> — the capture closed its session before re-reading the
          endpoint — so the banner is built from the start response and held in the browser instead. Ending it
          when the field goes missing is the line that goes in when a recording can show it; expiry is
          enforced by the server either way, never by a timer here.
        </CorpusNote>
      </DeskWork>
    </>
  );
}
