"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Kbd,
  Screen,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { Assignees } from "@/components/desk/assignees";
import { Marker } from "@/components/desk/marker";
import { NewIdeaAction } from "@/components/desk/new-idea";
import { CorpusNote, ErrorNotice, LoadingRows, RefusalNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useApi } from "@/lib/api";
import { PRIORITY_COLORS, daysAgo } from "@/lib/format";
import { useActivateOnSpace } from "@/lib/keys";
import type { IdeaListItem, Paged } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/**
 * Home — *what needs me now*, not *what exists*.
 *
 * **What the corpus can and cannot answer here, because it decides the whole screen.** There
 * is no dashboard endpoint and no activity endpoint: all 81 recorded endpoints are the plain
 * resource routes. So every number below is derived, in the browser, from the one recorded
 * page of `GET /organizations/{id}/ideas` — twenty of the organization's twenty-two ideas —
 * and each tile says what it counted rather than presenting a total the API never gave.
 *
 * Three of comp P's four tiles are not derivable, and none of them is faked:
 *
 *  - ***Open ideas*** would need to know which statuses are terminal. A status carries a
 *    name, a colour and a sort order and nothing else — no `isTerminal`, no category — so
 *    "open" is not computable, and taking the last status by sort order to mean *done* is
 *    exactly the guess that reads wrong here: the recorded list ends with a status the
 *    capture scenario created, not with Complete.
 *  - ***Awaiting review*** would need the client to decide which status name means review,
 *    which is a product rule about organization-defined data.
 *  - ***Completed · 30d*** would need a completion timestamp; a list item carries only
 *    `createdAtUtc`.
 *
 * What replaces them counts things the payload states outright — a name in the Assigned
 * field, the priority enum, a status id. *Recent activity* has no endpoint at all, so the
 * panel says so rather than showing a plausible feed.
 */

/** Comp P's greeting. Only ever called once the identity has arrived, so it never renders on the server. */
function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Kpi({
  label,
  value,
  sub,
  definition,
}: {
  label: string;
  value: number;
  sub: string;
  /** Comp P requires every tile to carry a one-line definition of what it counts. */
  definition: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        <div className="mt-3 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
          {definition}
        </div>
      </CardContent>
    </Card>
  );
}

export function HomeScreen() {
  const activateOnSpace = useActivateOnSpace();
  const { me, organization, organizationId, organizationCount, boards, statuses, stateOverride } =
    useWorkspace();
  const [tipOpen, setTipOpen] = React.useState(true);

  const isSiteAdmin = me?.role === "SiteAdmin";

  const ideas = useApi<Paged<IdeaListItem>>(
    organizationId ? `/organizations/${organizationId}/ideas` : null,
  );

  // `?? []` inline would mint a fresh array every render and the memos below would recompute
  // on every keystroke anywhere in the tree.
  const items = React.useMemo(() => ideas.data?.items ?? [], [ideas.data]);

  const firstStatus = statuses[0];
  const firstStatusId = firstStatus?.statusId;
  const myUserId = me?.userId;

  const assignedToMe = React.useMemo(
    () => items.filter((idea) => idea.assignees.some((one) => one.userId === myUserId)),
    [items, myUserId],
  );
  const unassigned = React.useMemo(
    () => items.filter((idea) => idea.assignees.length === 0),
    [items],
  );
  const notStarted = React.useMemo(
    () => items.filter((idea) => idea.statusId === firstStatusId),
    [items, firstStatusId],
  );

  // Comp P's rule is *critical, high priority, or a week without moving*, over open ideas.
  // Two of those three qualifiers are not available and neither is guessed at: a list item
  // carries no last-moved timestamp, and nothing in the payload says which statuses are
  // terminal — so "open" cannot be computed and a finished idea is not filtered out. Its
  // status is in the row instead, and the standfirst says so. Oldest first.
  const pressing = React.useMemo(
    () =>
      items
        .filter((idea) => idea.priority === "Critical" || idea.priority === "High")
        .sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc)),
    [items],
  );
  const attention = pressing.slice(0, 6);
  const attentionTotal = pressing.length;

  const statusesById = new Map(statuses.map((status) => [status.statusId, status]));
  const orgName = organization?.title ?? "your organization";
  const boardCount = boards.data?.length ?? 0;

  // The board list is part of the loading gate, not just of the copy: a request still in
  // flight reads as `data: null`, so an empty state decided before it lands would tell an
  // organization with three boards that it has none, and then correct itself.
  const state: ScreenState =
    stateOverride ??
    (ideas.state === "loading" || boards.state === "loading"
      ? "loading"
      : ideas.state === "error"
        ? "error"
        : items.length === 0
          ? "empty"
          : "normal");

  const title = me ? `${greeting(new Date())}, ${me.firstName}` : "Home";

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Home" }]}>
        <NewIdeaAction href="/ideas?create=1" />
      </DeskTopBar>

      <DeskWork>
        <PageHeader title={title}>
          {isSiteAdmin ? (
            <>
              Platform-wide, across every organization. You are not a member of any of them — to
              change what one owns, act as one of its administrators.
            </>
          ) : (
            <>
              Here&rsquo;s what {me?.role === "ReadOnly" ? "is moving" : "needs you"} today.{" "}
              {orgName} has {ideas.data?.totalCount ?? 0} ideas across {boardCount}{" "}
              {boardCount === 1 ? "board" : "boards"} — press <Kbd>Ctrl K</Kbd> to jump straight
              to any of them.
            </>
          )}
        </PageHeader>

        <Screen state={state} data-testid="home-screen">
          <When state="loading">
            <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((slot) => (
                <Card key={slot} className="gap-0 py-4">
                  <CardContent className="px-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-3 h-6 w-12" />
                    <Skeleton className="mt-3 h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <LoadingRows rows={5} />
          </When>

          <When state="error">
            {ideas.error?.isRefusal ? (
              <RefusalNotice error={ideas.error} />
            ) : ideas.error?.isMockGap ? (
              <CorpusNote>{ideas.error.message}</CorpusNote>
            ) : (
              <ErrorNotice error={ideas.error} what="your boards" onRetry={ideas.reload} />
            )}
          </When>

          <When state="empty">
            <Empty>
              <EmptyTitle>{boardCount === 0 ? "No boards yet" : "Nothing to show yet"}</EmptyTitle>
              <EmptyDescription>
                {boardCount === 0
                  ? "This organization doesn’t have any boards to show. An Org Admin can create boards from Settings."
                  : "There are no ideas on the boards you can reach, so there is nothing waiting on you."}
              </EmptyDescription>
            </Empty>
          </When>

          <When state="normal">
            {/* Comp P shows the first-run strip to the three member roles only: a Site Admin
                does not start ideas, so "start one from any board" is not addressed to them. */}
            {tipOpen && !isSiteAdmin ? (
              <Alert role="note" className="mb-4 grid-cols-[1fr_auto] items-start gap-4">
                <AlertDescription>
                  <strong className="font-medium text-foreground">New to Collega?</strong> An idea
                  moves through the statuses your organization defines, and the people, comments
                  and history stay attached the whole way. Start one from any board, or press{" "}
                  <Kbd>Ctrl K</Kbd>.
                </AlertDescription>
                <Button variant="outline" size="sm" onClick={() => setTipOpen(false)}>
                  Got it
                </Button>
              </Alert>
            ) : null}

            <CorpusNote className="mb-4">
              the corpus holds one page of this organization&rsquo;s ideas — {items.length} of{" "}
              {ideas.data?.totalCount ?? items.length} — and no dashboard endpoint, so every tile
              below counts that page rather than reading a total the API never returned.
            </CorpusNote>

            {/* Every tile counts something the payload states outright — a name in the
                Assigned field, a priority enum, a status id. None of them assumes which
                statuses mean *done*, because nothing in the API says. */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {isSiteAdmin ? (
                <>
                  <Kpi
                    label="Organizations"
                    value={organizationCount ?? 0}
                    sub={`browsing ${orgName}`}
                    definition="Every organization on this deployment, from the one endpoint only a Site Admin may call."
                  />
                  <Kpi
                    label="Boards"
                    value={boardCount}
                    sub={`in ${orgName}`}
                    definition={`Every board in ${orgName}. Open one to read it; to change it, act as one of its administrators.`}
                  />
                </>
              ) : (
                <>
                  <Kpi
                    label="Assigned to me"
                    value={assignedToMe.length}
                    sub={`of ${items.length} on this page`}
                    definition="Ideas with your name in the Assigned field."
                  />
                  <Kpi
                    label="Unassigned"
                    value={unassigned.length}
                    sub={`of ${items.length} on this page`}
                    definition="Ideas with nobody in the Assigned field yet — the ones nobody has picked up."
                  />
                </>
              )}
              <Kpi
                label="Critical or high"
                value={attentionTotal}
                sub={`of ${items.length} on this page`}
                definition="Ideas the organization marked Critical or High priority, whatever status they are in."
              />
              {firstStatus ? (
                <Kpi
                  label={`In ${firstStatus.name}`}
                  value={notStarted.length}
                  sub={`of ${items.length} on this page`}
                  definition={`Sitting in ${firstStatus.name}, the first status by sort order — nobody has moved them on yet.`}
                />
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle>Needs your attention</CardTitle>
                    <CardDescription>
                      Critical and high-priority ideas, oldest first — a stalled idea is the
                      failure mode, not a busy one. Nothing in the payload says which statuses
                      are terminal, so a finished idea is not filtered out; its status is in
                      the row.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/ideas">View all</Link>
                  </Button>
                </CardHeader>

                <div className="relative mt-4 overflow-x-auto">
                  {attention.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">
                      Nothing on this page is critical or high priority.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[42%] min-w-56">Idea</TableHead>
                          <TableHead className="min-w-36">Status</TableHead>
                          <TableHead className="hidden min-w-28 md:table-cell">Priority</TableHead>
                          <TableHead className="hidden min-w-28 lg:table-cell">Assigned</TableHead>
                          <TableHead className="min-w-28">Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attention.map((idea) => (
                          <TableRow key={idea.ideaId}>
                            <TableCell>
                              <Link
                                href={`/ideas?idea=${idea.ideaId}`}
                                onKeyDown={activateOnSpace}
                                className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                {idea.title}
                              </Link>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {idea.ideaTypeName}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Marker color={statusesById.get(idea.statusId)?.color}>
                                {idea.statusName}
                              </Marker>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Marker color={PRIORITY_COLORS[idea.priority]}>{idea.priority}</Marker>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Assignees assignees={idea.assignees} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {daysAgo(idea.createdAtUtc)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </Card>

              <Card className="gap-0">
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>
                    Everything anyone changed in {orgName}, newest first, scoped to the boards you
                    can reach.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-4">
                  <CorpusNote>
                    the .NET API had no activity or audit-feed endpoint, so the capture recorded
                    none and there is nothing to replay. The panel keeps its place so the layout
                    can be judged; a plausible feed here would be invented, which is the one thing
                    this build must not do.
                  </CorpusNote>
                </CardContent>
              </Card>
            </div>
          </When>
        </Screen>

      </DeskWork>
    </>
  );
}
