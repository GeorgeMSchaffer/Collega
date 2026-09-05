"use client";

/**
 * The sprint board: the running sprint's issues in the five fixed delivery statuses.
 *
 * The statuses are `Pending, Scoping, Development, Review, Complete` and are **not** the
 * organization's ideation swimlanes — `SPEC/20-feature-issues-and-delivery.md` fixes them and
 * says they never mix. So this board draws its own five lanes rather than reading statuses,
 * and it is deliberately the same 288px rail as the ideation board with a card carrying two
 * extra facts: an effort marker and a task rollup.
 *
 * Movement is not on the card. The comp draws drag-between-lanes, and a prototype that fakes
 * drag teaches a reviewer an interaction the real screen may not be able to afford; the
 * spec's own keyboard path is the status selector on the issue, which this prototype does
 * implement. The standfirst says so rather than leaving a keyboard user to discover it.
 */

import {
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Screen,
  Skeleton,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";

import { ErrorNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useWorkspace } from "@/lib/workspace";

import { mayMutate, refusalReason } from "@/app/(desk)/settings/_lib/rules";
import {
  EffortMarker,
  IssueCard,
  PrototypeAction,
  PrototypeStrip,
  SprintStateMarker,
  StatusMarker,
} from "@/app/(desk)/delivery/_prototype/chrome";
import {
  SAMPLE_ACTIVE_SPRINT_ID,
  SAMPLE_DELIVERY_STATUSES,
  SAMPLE_ISSUES,
  sampleDaysLeft,
  sampleSprint,
  sampleTaskRollup,
  sampleWindow,
} from "@/app/(desk)/delivery/_prototype/sample-data";

export function SprintBoardScreen() {
  const { me, stateOverride } = useWorkspace();
  const mutable = mayMutate(me?.role, "org-content");
  const denied = refusalReason(me?.role, "org-content");

  const sprint = sampleSprint(SAMPLE_ACTIVE_SPRINT_ID);
  const issues = SAMPLE_ISSUES.filter((issue) => issue.sprintId === SAMPLE_ACTIVE_SPRINT_ID);
  const backlogCount = SAMPLE_ISSUES.filter((issue) => issue.sprintId === null).length;

  // The mock bar's state control still drives the four states, so the empty, loading and
  // error designs can be reviewed here the way they can on every other screen.
  const state: ScreenState = stateOverride ?? (sprint === null ? "empty" : "normal");

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Delivery" }, { label: "Sprint board" }]}>
        <Button variant="outline" asChild>
          <Link href="/delivery/backlog">Plan next sprint</Link>
        </Button>
        {mutable ? (
          <PrototypeAction>
            {(props) => (
              <Button variant="outline" {...props}>
                Complete sprint
              </Button>
            )}
          </PrototypeAction>
        ) : (
          <PrototypeAction reason={denied ?? "Administrators only"}>
            {(props) => (
              <Button variant="outline" {...props}>
                Complete sprint
              </Button>
            )}
          </PrototypeAction>
        )}
      </DeskTopBar>

      <PrototypeStrip />

      <DeskWork>
        <PageHeader title="Sprint board">
          The issues committed to the running sprint, in the five fixed delivery statuses. The set is
          fixed by the product, not configured per organization, so this board never inherits an
          organization&rsquo;s ideation swimlanes. A card&rsquo;s status is changed from the issue itself.
        </PageHeader>

        <Screen state={state} data-testid="sprint-board-screen">
          <When state="loading">
            <div className="relative flex items-start gap-3 overflow-x-auto pb-3">
              <span className="sr-only">Loading the sprint</span>
              {SAMPLE_DELIVERY_STATUSES.map((status) => (
                <div key={status} className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2">
                  <Skeleton className="mx-2 mt-1 mb-3 h-3 w-24" />
                  <div className="rounded-md border bg-card p-2.5">
                    <Skeleton className="h-3 w-[80%]" />
                    <Skeleton className="mt-2 h-3 w-[45%]" />
                  </div>
                </div>
              ))}
            </div>
          </When>

          <When state="error">
            <ErrorNotice what="the sprint" />
          </When>

          <When state="empty">
            <Empty>
              <EmptyTitle>No sprint is running</EmptyTitle>
              <EmptyDescription>
                There are {backlogCount} issues in the delivery backlog and no active sprint. An
                administrator plans a sprint from the backlog, then starts it — starting is an action,
                never something derived from the dates.
              </EmptyDescription>
              <Button variant="outline" asChild className="mt-4">
                <Link href="/delivery/backlog">See the backlog</Link>
              </Button>
            </Empty>
          </When>

          <When state="normal">
            {sprint ? (
              <Card className="mb-4">
                {/* Stacked below sm. Side by side, the dates column is `shrink-0` and the goal
                    beside it collapses to one word per line at 390. */}
                <CardContent className="flex flex-col items-start gap-2 sm:flex-row sm:gap-x-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="m-0 text-base font-semibold tracking-tight">{sprint.name}</h2>
                      <SprintStateMarker state={sprint.state} className="text-xs" />
                    </div>
                    <p className="m-0 mt-1 text-sm text-muted-foreground">Goal — {sprint.goal}</p>
                  </div>
                  <div className="shrink-0 text-sm">
                    <p className="m-0 tabular-nums">{sampleWindow(sprint.startDate, sprint.endDate)}</p>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                      {issues.length} issues · {sampleDaysLeft(sprint)} days left ·{" "}
                      {sprint.owner ?? "no owner"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* `relative` is load-bearing: `sr-only` is absolutely positioned, and without a
                containing block here the off-screen lane labels give the *page* a horizontal
                scrollbar. The rail scrolls; the page never does. */}
            <div className="relative flex items-start gap-3 overflow-x-auto pb-3">
              {SAMPLE_DELIVERY_STATUSES.map((status) => {
                const cards = issues.filter((issue) => issue.deliveryStatus === status);
                return (
                  <section
                    key={status}
                    aria-label={`${status}, ${cards.length} ${cards.length === 1 ? "issue" : "issues"}`}
                    className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2"
                  >
                    <h2 className="flex items-center gap-2 px-2 pt-1 pb-2 text-sm">
                      <StatusMarker status={status} className="font-medium" />
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {cards.length}
                      </span>
                    </h2>
                    <div className="flex flex-col gap-2">
                      {cards.map((issue) => {
                        const rollup = sampleTaskRollup(issue);
                        return (
                          <IssueCard
                            key={issue.key}
                            issue={issue}
                            done={rollup.done}
                            total={rollup.total}
                          />
                        );
                      })}
                      {cards.length === 0 ? (
                        <p className="m-0 px-2 py-3 text-xs text-muted-foreground">No issues</p>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>

            <Card className="mt-4">
              <CardContent>
                <h2 className="m-0 mb-2 text-base font-semibold tracking-tight">
                  What this sprint is carrying
                </h2>
                <ul className="m-0 list-none space-y-1.5 p-0 text-sm text-muted-foreground">
                  <li className="flex flex-wrap items-center gap-2">
                    <span>Effort committed:</span>
                    {(["Low", "Medium", "High"] as const).map((effort) => (
                      <span key={effort} className="inline-flex items-center gap-1">
                        <EffortMarker effort={effort} className="text-xs" />
                        <span className="text-xs tabular-nums">
                          ×{issues.filter((issue) => issue.effort === effort).length}
                        </span>
                      </span>
                    ))}
                  </li>
                  <li>
                    Completing a sprint returns every issue that is not <strong>Complete</strong> to the
                    backlog. Nothing is deleted, and an issue&rsquo;s tasks travel with it.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </When>
        </Screen>
      </DeskWork>
    </>
  );
}
