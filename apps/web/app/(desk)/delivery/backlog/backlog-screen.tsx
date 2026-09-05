"use client";

/**
 * The delivery backlog, and the sprint an administrator is planning out of it.
 *
 * Two things about this screen come straight from the spec rather than from taste. The list is
 * ordered **most upvoted first**, so it reads as the organization's own priority order rather
 * than as a queue somebody arranged. And the Sprint column is *a control for an administrator
 * and a value for everyone else* — a member does not meet a disabled select here, because the
 * backlog is a list they consult, not a screen they act on.
 *
 * The two interactions on this screen are real, and local. Assigning a sprint moves the row;
 * saving the sprint updates the card above it, including the `EndDate >= StartDate` invariant
 * the domain enforces. Nothing leaves the tab — the prototype strip says so.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Input,
  Label,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { ErrorNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useActivateOnSpace } from "@/lib/keys";
import { useWorkspace } from "@/lib/workspace";

import { mayMutate, refusalReason } from "@/app/(desk)/settings/_lib/rules";
import {
  EffortMarker,
  IssueKey,
  PrototypeAction,
  PrototypeStrip,
  SprintStateMarker,
} from "@/app/(desk)/delivery/_prototype/chrome";
import {
  SAMPLE_ISSUES,
  SAMPLE_NEXT_PLANNED_SPRINT_ID,
  sampleSprint,
  sampleWindow,
} from "@/app/(desk)/delivery/_prototype/sample-data";

/** "— backlog" is a real option, not an absence: unassigning is a choice an admin makes. */
const BACKLOG = "backlog";

const OWNERS = ["Unassigned", "Olivia Administer", "Maya Collaborator", "Marcus Green"] as const;

export function BacklogScreen() {
  const { me, stateOverride } = useWorkspace();
  const activateOnSpace = useActivateOnSpace();
  const mutable = mayMutate(me?.role, "org-content");
  const denied = refusalReason(me?.role, "org-content");

  const planned = sampleSprint(SAMPLE_NEXT_PLANNED_SPRINT_ID);

  // Which issues sit in the planned sprint, as this tab currently has it. The rest of the
  // sample data is immutable; only the assignment moves.
  const [assigned, setAssigned] = React.useState<readonly string[]>(() =>
    SAMPLE_ISSUES.filter((issue) => issue.sprintId === SAMPLE_NEXT_PLANNED_SPRINT_ID).map(
      (issue) => issue.key,
    ),
  );

  const [goal, setGoal] = React.useState(planned?.goal ?? "");
  const [start, setStart] = React.useState(planned?.startDate ?? "");
  const [end, setEnd] = React.useState(planned?.endDate ?? "");
  const [owner, setOwner] = React.useState(planned?.owner ?? "Unassigned");
  const [saved, setSaved] = React.useState<{
    goal: string;
    start: string;
    end: string;
    owner: string;
  } | null>(null);
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Everything not in a running or finished sprint: the backlog proper, plus whatever has
  // been pulled into the sprint being planned. Both belong on the screen an admin plans from.
  const rows = React.useMemo(
    () =>
      [...SAMPLE_ISSUES]
        .filter(
          (issue) =>
            issue.sprintId === null || issue.sprintId === SAMPLE_NEXT_PLANNED_SPRINT_ID,
        )
        .sort((a, b) => b.upvotes - a.upvotes),
    [],
  );

  const backlogCount = rows.filter((issue) => !assigned.includes(issue.key)).length;

  const state: ScreenState = stateOverride ?? (rows.length === 0 ? "empty" : "normal");

  const onSave = (event: React.FormEvent) => {
    event.preventDefault();
    // A `type="date"` input can be cleared, and an empty date reaches `sampleWindow` as an
    // Invalid Date, which `Intl` throws on — during render, so the whole screen would go to
    // the error boundary. Required comes first, then the one invariant the domain enforces
    // on a sprint, so the prototype shows what a violation looks like and not only a happy path.
    if (start === "" || end === "") {
      setDateError("A sprint needs both a start and an end date.");
      setSaved(null);
      return;
    }
    if (end < start) {
      setDateError("The end date must be on or after the start date.");
      setSaved(null);
      return;
    }
    setDateError(null);
    setSaved({ goal, start, end, owner });
  };

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Delivery" }, { label: "Backlog" }]}>
        {/* Only the one action. Creating a sprint is exactly the form below this table, so a
            second control in the bar would be a button for a thing already on the screen —
            and each denied control costs a repeated reason string in a crowded bar. */}
        <PrototypeAction reason={mutable ? undefined : (denied ?? "Administrators only")}>
          {(props) => <Button {...props}>Start {planned?.name ?? "the sprint"}</Button>}
        </PrototypeAction>
      </DeskTopBar>

      <PrototypeStrip />

      <DeskWork>
        <PageHeader title="Backlog">
          Issues that are committed but not yet in a running sprint, most upvoted first — so the list
          reads as the organization&rsquo;s own priority order. Assigning a sprint moves the row; it is
          still the same idea, still carrying its history.
        </PageHeader>

        <Screen state={state} data-testid="backlog-screen">
          <When state="loading">
            <div className="rounded-xl border bg-card p-4">
              <span className="sr-only">Loading the backlog</span>
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="mt-4 h-3 first:mt-0" style={{ width: `${80 - row * 6}%` }} />
              ))}
            </div>
          </When>

          <When state="error">
            <ErrorNotice what="the backlog" />
          </When>

          <When state="empty">
            <Empty>
              <EmptyTitle>Nothing waiting</EmptyTitle>
              <EmptyDescription>
                Every committed issue is in a sprint. New issues arrive here when an idea is promoted
                from a board — promotion is an explicit decision, never a side effect of an idea
                reaching a status.
              </EmptyDescription>
            </Empty>
          </When>

          <When state="normal">
            <Card className="mb-4">
              <CardContent className="px-0">
                <div className="flex flex-wrap items-baseline gap-2 px-6 pb-3">
                  <h2 className="m-0 text-base font-semibold tracking-tight">Delivery backlog</h2>
                  <span className="text-xs text-muted-foreground">
                    {backlogCount} unassigned · {assigned.length} pulled into{" "}
                    {planned?.name ?? "the next sprint"}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Key</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="w-36">Effort</TableHead>
                      <TableHead className="w-20">Votes</TableHead>
                      <TableHead className="w-48">Sprint</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((issue) => {
                      const inSprint = assigned.includes(issue.key);
                      return (
                        <TableRow key={issue.key}>
                          <TableCell>
                            <IssueKey>{issue.key}</IssueKey>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/delivery/issues/${issue.key}`}
                              onKeyDown={activateOnSpace}
                              className="font-medium text-foreground hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {issue.title}
                            </Link>
                            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                              Raised by {issue.author}
                            </p>
                          </TableCell>
                          <TableCell>
                            <EffortMarker effort={issue.effort} className="text-xs" />
                          </TableCell>
                          <TableCell className="tabular-nums">{issue.upvotes}</TableCell>
                          <TableCell>
                            {mutable ? (
                              <Select
                                value={inSprint ? SAMPLE_NEXT_PLANNED_SPRINT_ID : BACKLOG}
                                onValueChange={(value) =>
                                  setAssigned((keys) =>
                                    value === BACKLOG
                                      ? keys.filter((key) => key !== issue.key)
                                      : [...keys, issue.key],
                                  )
                                }
                              >
                                <SelectTrigger
                                  size="sm"
                                  aria-label={`Sprint for ${issue.key}, ${issue.title}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={BACKLOG}>— backlog</SelectItem>
                                  <SelectItem value={SAMPLE_NEXT_PLANNED_SPRINT_ID}>
                                    {planned?.name ?? "Next sprint"}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              // Not a disabled control: a member consults this list, they do
                              // not act on it, so the column is a value for them.
                              <span className="text-sm text-muted-foreground">
                                {inSprint ? (planned?.name ?? "Next sprint") : "— backlog"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <Card>
                <CardContent>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="m-0 text-base font-semibold tracking-tight">
                      {planned?.name ?? "Next sprint"}
                    </h2>
                    {planned ? <SprintStateMarker state={planned.state} className="text-xs" /> : null}
                  </div>
                  {/* Every field the form below edits is echoed here, goal included. A form
                      whose Save reports success while one of its fields changes nothing on
                      screen is the dead control this prototype's strip exists to rule out. */}
                  <p className="m-0 text-sm text-muted-foreground">
                    {assigned.length} {assigned.length === 1 ? "issue" : "issues"} assigned ·{" "}
                    {saved
                      ? `${sampleWindow(saved.start, saved.end)} · ${saved.owner}`
                      : planned
                        ? `${sampleWindow(planned.startDate, planned.endDate)} · ${planned.owner ?? "no owner"}`
                        : ""}
                    . Starting a sprint is an action, never derived from its dates.
                  </p>
                  <p className="m-0 mt-1 mb-4 text-sm text-muted-foreground">
                    Goal — {saved ? saved.goal : (planned?.goal ?? "not set")}
                  </p>

                  {mutable ? (
                    <form className="flex flex-col gap-4" onSubmit={onSave}>
                      <div>
                        <Label htmlFor="delivery-sprint-goal">Goal</Label>
                        <Textarea
                          id="delivery-sprint-goal"
                          rows={2}
                          value={goal}
                          onChange={(event) => setGoal(event.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="delivery-sprint-start">Starts</Label>
                          <Input
                            id="delivery-sprint-start"
                            type="date"
                            value={start}
                            onChange={(event) => setStart(event.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="delivery-sprint-end">Ends</Label>
                          <Input
                            id="delivery-sprint-end"
                            type="date"
                            value={end}
                            onChange={(event) => setEnd(event.target.value)}
                            aria-invalid={dateError !== null || undefined}
                            aria-describedby="delivery-sprint-end-hint"
                          />
                          <p
                            id="delivery-sprint-end-hint"
                            className={`m-0 mt-1 text-xs ${dateError ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {dateError ?? "On or after the start date."}
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="delivery-sprint-owner">
                          Owner <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Select value={owner} onValueChange={setOwner}>
                          <SelectTrigger id="delivery-sprint-owner">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OWNERS.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Button type="submit">Save sprint</Button>
                      </div>
                      {saved && !dateError ? (
                        <Alert variant="warning" role="status">
                          <AlertTitle>Kept in this tab only</AlertTitle>
                          <AlertDescription>
                            The card above now reads the values you entered. There is no backend behind
                            this screen, so a reload restores the sample sprint.
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </form>
                  ) : planned ? (
                    <dl className="m-0 grid grid-cols-[minmax(84px,auto)_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Goal</dt>
                      <dd className="m-0">{planned.goal}</dd>
                      <dt className="text-muted-foreground">Window</dt>
                      <dd className="m-0 tabular-nums">
                        {sampleWindow(planned.startDate, planned.endDate)}
                      </dd>
                      <dt className="text-muted-foreground">Owner</dt>
                      <dd className="m-0">{planned.owner ?? "Unassigned"}</dd>
                    </dl>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h2 className="m-0 mb-2 text-base font-semibold tracking-tight">Sprint lifecycle</h2>
                  <ol className="m-0 mb-3 flex list-none flex-wrap items-center gap-2 p-0">
                    {(["Planned", "Active", "Completed"] as const).map((state, index) => (
                      <li key={state} className="flex items-center gap-2">
                        {index > 0 ? <span aria-hidden="true">→</span> : null}
                        <SprintStateMarker state={state} className="text-xs" />
                      </li>
                    ))}
                  </ol>
                  <p className="m-0 text-sm text-foreground/80">
                    The transitions are explicit actions, not dates passing. Completing a sprint returns
                    every unfinished issue to this backlog — carry-over is deterministic, nothing is
                    deleted, and an issue&rsquo;s tasks travel with it.
                  </p>
                </CardContent>
              </Card>
            </div>
          </When>
        </Screen>
      </DeskWork>
    </>
  );
}
