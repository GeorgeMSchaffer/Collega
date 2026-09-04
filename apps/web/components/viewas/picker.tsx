"use client";

/**
 * The picker: `SPEC/20-feature-view-as.md` rule 21 — a right slide-in drawer, searchable,
 * grouped by organization for a Site Admin, own organization only for an Org Admin.
 *
 * The drawer is the shared `Sheet`, which is Radix Dialog underneath, so Escape, the focus
 * trap and the inert background come from the primitive rather than from a hand-rolled
 * listener — the class of bug Sprint 7.5 found on the Blazor drawers. Focus restore is the
 * one part taken over by hand: the picker has two entry points (D-PLACE) and one of them
 * navigates first, so the control that opened it is remembered explicitly rather than
 * inferred from whatever happened to be focused.
 *
 * The list is filtered in the browser. `GET /auth/view-as/candidates` takes a `search`
 * parameter, but the corpus recorded the endpoint without one — sending it would have the
 * mock answer a filtered request with the unfiltered recording and quietly flag it. Narrowing
 * the recorded list is real work on real data and says what it is; when Nest is behind this,
 * the filter moves into the query string and this comment goes with it.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DeniedAction,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote, RefusalNotice } from "@/components/desk/notices";
import { EyeIcon } from "@/components/viewas/eye-icon";
import { personName, useViewAs, useViewAsInvoker } from "@/components/viewas/session";
import { candidateName, isSelectable, type ViewAsCandidate } from "@/components/viewas/types";
import { useApi } from "@/lib/api";
import { ROLE_LABELS, initialsOf } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

function matches(candidate: ViewAsCandidate, needle: string): boolean {
  if (needle === "") return true;
  const haystack = [
    candidate.firstName,
    candidate.lastName,
    candidate.email,
    candidate.organizationName,
    ROLE_LABELS[candidate.role],
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

interface Group {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly rows: readonly ViewAsCandidate[];
}

/** Keyed on the id, labelled with the name: two organizations may share a display name. */
function groupByOrganization(candidates: readonly ViewAsCandidate[]): readonly Group[] {
  const groups = new Map<string, ViewAsCandidate[]>();
  for (const candidate of candidates) {
    const existing = groups.get(candidate.organizationId);
    if (existing) existing.push(candidate);
    else groups.set(candidate.organizationId, [candidate]);
  }
  return [...groups]
    .map(([organizationId, rows]) => ({
      organizationId,
      organizationName: rows[0]!.organizationName,
      rows,
    }))
    .sort((left, right) => left.organizationName.localeCompare(right.organizationName));
}

function CandidateRow({
  candidate,
  onPick,
  disabled,
}: {
  candidate: ViewAsCandidate;
  onPick: (candidate: ViewAsCandidate) => void;
  disabled: boolean;
}) {
  const name = candidateName(candidate);
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground"
      >
        {initialsOf(candidate.firstName, candidate.lastName)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{candidate.email}</span>
      </span>
      <Badge variant={candidate.role === "OrgAdmin" ? "default" : "outline"} className="shrink-0">
        {ROLE_LABELS[candidate.role]}
      </Badge>
    </>
  );

  const rowClass =
    "flex w-full items-center gap-3 border-b px-6 py-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset";

  // Rule 10: a target that is not `Active` is listed and refused, never quietly dropped.
  // `DeniedAction` is the frozen pattern for that — aria-disabled rather than disabled, so
  // the row keeps its tab stop and the reason is read out on focus instead of being colour.
  if (!isSelectable(candidate)) {
    return (
      <DeniedAction
        reason="Inactive — the server refuses this target."
        className="flex w-full flex-col items-stretch gap-0 border-b"
      >
        {(denied) => (
          <button type="button" {...denied} className={`${rowClass} border-b-0`}>
            {body}
          </button>
        )}
      </DeniedAction>
    );
  }

  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => onPick(candidate)}
      disabled={disabled}
      data-testid="view-as-candidate"
    >
      {body}
    </button>
  );
}

/**
 * The drawer's contents, mounted only while it is open.
 *
 * That is what resets the search box between openings and what keeps the candidate list from
 * being fetched on every screen — for a User or a Read Only account the endpoint is a
 * recorded 403, and there is no reason to go and collect that refusal until it is asked for.
 * Both fall out of the mount rather than needing an effect to arrange them.
 */
function PickerBody() {
  const { closePicker, start, starting, session, error } = useViewAs();
  const { me } = useWorkspace();
  const [search, setSearch] = React.useState("");
  const searchId = React.useId();

  const candidates = useApi<ViewAsCandidate[]>("/auth/view-as/candidates");

  const needle = search.trim().toLowerCase();
  const shown = React.useMemo(
    () => (candidates.data ?? []).filter((candidate) => matches(candidate, needle)),
    [candidates.data, needle],
  );
  const groups = React.useMemo(() => groupByOrganization(shown), [shown]);
  const grouped = groups.length > 1;

  // The order Enter follows has to be the order on screen: grouping re-sorts the list by
  // organization, so taking the first selectable from the API's order would name somebody
  // other than the top row — a consequential thing to get wrong by default.
  const rendered = grouped ? groups.flatMap((group) => group.rows) : shown;
  const firstSelectable = rendered.find(isSelectable) ?? null;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (firstSelectable && !starting && !session) void start(firstSelectable);
  };

  return (
    <>
      <SheetHeader className="px-6 py-5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-primary uppercase">
          <EyeIcon className="size-3.5" />
          View as
        </span>
        <SheetTitle className="text-lg">View as another user</SheetTitle>
        <SheetDescription>
          Browse Collega exactly as they see it. A banner stays on screen the whole time; exit in one click.
        </SheetDescription>
      </SheetHeader>

      {session ? (
        // Rule 5: sessions do not nest, and are never silently replaced.
        <div className="p-6">
          <Alert variant="warning">
            <AlertTitle>You are already viewing as {personName(session.impersonating)}</AlertTitle>
            <AlertDescription>
              View As sessions do not nest. Exit the session in the banner first, then start another.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <>
          <form className="border-b px-6 py-4" onSubmit={onSubmit}>
            <Label htmlFor={searchId}>Search people</Label>
            <Input
              id={searchId}
              type="search"
              value={search}
              autoComplete="off"
              placeholder="Name, email or organization"
              onChange={(event) => setSearch(event.target.value)}
            />
            <p className="mt-2 mb-0 text-xs text-muted-foreground">
              {firstSelectable
                ? `Press Enter to view as ${candidateName(firstSelectable)}.`
                : "Nobody here matches that."}
            </p>
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <div className="p-6">
                <Alert variant="destructive">
                  <AlertTitle>
                    {error.status === 409
                      ? "A View As session is already running"
                      : (error.problem?.title ?? "The session could not be started")}
                  </AlertTitle>
                  <AlertDescription>
                    {error.problem?.detail ?? "Nothing has changed. You are still yourself."}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}

            {candidates.state === "loading" ? (
              <div className="space-y-3 p-6">
                <span className="sr-only">Loading the people you can view as</span>
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-9 w-full" />
                ))}
              </div>
            ) : null}

            {candidates.error?.isRefusal ? (
              <div className="p-6">
                <RefusalNotice error={candidates.error} what="View as" />
              </div>
            ) : null}

            {candidates.error && !candidates.error.isRefusal ? (
              <div className="p-6">
                <CorpusNote>
                  the mock has no recording of <code>GET /auth/view-as/candidates</code> for this identity, so
                  there is nobody to list. {candidates.error.problem?.detail ?? ""}
                </CorpusNote>
              </div>
            ) : null}

            {candidates.state === "ready" && shown.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                {needle === "" ? "There is nobody you can act as." : `No user matches “${search}”.`}
              </p>
            ) : null}

            {grouped
              ? groups.map((group) => (
                  <section key={group.organizationId}>
                    <h3 className="sticky top-0 z-10 bg-muted px-6 py-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      {group.organizationName}
                    </h3>
                    {group.rows.map((candidate) => (
                      <CandidateRow
                        key={candidate.userId}
                        candidate={candidate}
                        onPick={(picked) => void start(picked)}
                        disabled={starting}
                      />
                    ))}
                  </section>
                ))
              : shown.map((candidate) => (
                  <CandidateRow
                    key={candidate.userId}
                    candidate={candidate}
                    onPick={(picked) => void start(picked)}
                    disabled={starting}
                  />
                ))}
          </div>
        </>
      )}

      <SheetFooter className="flex-col items-stretch gap-3 px-6 py-4 text-xs text-muted-foreground">
        <p className="m-0">
          {me?.role === "SiteAdmin"
            ? "Site Admin — every organization's active users. Other Site Admins are never listed."
            : "Org Admin — active members of your own organization only. No cross-organization access."}
        </p>
        <CorpusNote>
          the mock matches a request by method, path and identity — never by its body — so every start replays
          the one recorded session. The banner names whoever the server answered with, which may not be the
          row you clicked.
        </CorpusNote>
        <div className="flex justify-end">
          <Button variant="outline" onClick={closePicker}>
            Cancel
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

export function ViewAsPicker() {
  const { pickerOpen, closePicker } = useViewAs();
  const invoker = useViewAsInvoker();

  return (
    <Sheet open={pickerOpen} onOpenChange={(open) => !open && closePicker()}>
      <SheetContent
        side="right"
        className="w-[min(560px,96vw)] gap-0 p-0"
        onCloseAutoFocus={(event) => {
          // Radix restores focus to whatever was focused when the drawer opened. One entry
          // point navigates to /view-as and opens from there, where that is the document
          // body, so the invoking control is handed focus explicitly instead.
          event.preventDefault();
          invoker.current?.focus();
        }}
      >
        <PickerBody />
      </SheetContent>
    </Sheet>
  );
}
