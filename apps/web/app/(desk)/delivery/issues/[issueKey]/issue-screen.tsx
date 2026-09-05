"use client";

/**
 * One issue, in its Delivery lens.
 *
 * The Issue **is** the Idea — the same row in a later phase, never a copy — which is what makes
 * the Provenance panel possible without any bookkeeping: it is the idea's own record, unretyped.
 * `SPEC/20-feature-issues-and-delivery.md` calls that panel the differentiator and says it ships
 * in this slice, so it is the one thing on this screen that is not negotiable.
 *
 * Two rules the panels below are shaped by:
 *
 *  - **Tasks never gate.** The checklist informs the standup; an outstanding task does not block
 *    `Complete`, and the UI warns where the domain permits. Setting the status to Complete with
 *    tasks open shows that warning rather than refusing.
 *  - **One outcome, changed by picking another.** Single-parent (`SPEC/decisions.md` 2026-09-02),
 *    so the picker is a radio group and the change is a *move*. A checkbox list would make it an
 *    add, and an add is what turns every roadmap total into a cover instead of a count.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Input,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorFooter,
  InspectorHeader,
  InspectorLayout,
  InspectorTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  When,
  Screen,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useCloseOnEscape } from "@/lib/keys";
import { useWorkspace } from "@/lib/workspace";

import { mayMutate, refusalReason } from "@/app/(desk)/settings/_lib/rules";
import {
  EffortMarker,
  Fact,
  Facts,
  IssueKey,
  PrototypeAction,
  PrototypeStrip,
  SampleAvatars,
  SprintStateMarker,
  StatusMarker,
  TagRow,
  TaskProgress,
} from "@/app/(desk)/delivery/_prototype/chrome";
import {
  SAMPLE_DELIVERY_STATUSES,
  SAMPLE_ISSUES,
  SAMPLE_OUTCOMES,
  SAMPLE_TASK_STATES,
  SAMPLE_TODAY,
  sampleDate,
  sampleIssue,
  sampleOutcome,
  sampleSprint,
  type SampleDeliveryStatus,
  type SampleTask,
  type SampleTaskState,
} from "@/app/(desk)/delivery/_prototype/sample-data";

/** The radio value that means "no outcome". Null cannot be a radio value. */
const UNGROUPED = "ungrouped";

export function IssueScreen({ issueKey }: { issueKey: string }) {
  const { me, stateOverride } = useWorkspace();
  const mutable = mayMutate(me?.role, "org-content");
  const denied = refusalReason(me?.role, "org-content");

  const issue = sampleIssue(issueKey);

  const [status, setStatus] = React.useState<SampleDeliveryStatus>(
    issue?.deliveryStatus ?? "Pending",
  );
  const [tasks, setTasks] = React.useState<readonly SampleTask[]>(issue?.tasks ?? []);
  const [newTask, setNewTask] = React.useState("");
  const [outcomeId, setOutcomeId] = React.useState<string | null>(issue?.outcomeId ?? null);

  // The outcome picker, docked as a column rather than opened as a drawer: it is a short form,
  // nothing behind it is covered, and there is no focus trap. Escape closes it and hands focus
  // back to the control that opened it — a Sprint 7.5 finding, and the reason the ref exists.
  const [picking, setPicking] = React.useState(false);
  const [pending, setPending] = React.useState<string>(outcomeId ?? UNGROUPED);
  const changeRef = React.useRef<HTMLButtonElement>(null);
  const closePicker = React.useCallback(() => {
    setPicking(false);
    changeRef.current?.focus();
  }, []);
  useCloseOnEscape(picking, closePicker);

  const state: ScreenState = stateOverride ?? (issue === null ? "empty" : "normal");

  // "Nothing to show" is this screen's only empty state, so the mock bar's Empty lands here
  // too rather than on a fully populated issue that merely claims to be empty.
  if (!issue || state === "empty") {
    return (
      <>
        <DeskTopBar crumbs={[{ label: "Delivery", href: "/delivery" }, { label: issueKey }]} />
        <PrototypeStrip />
        <DeskWork>
          <Screen state="empty" data-testid="issue-screen">
            <PageHeader title="No such issue in the sample set">
              This prototype has no backend to look <code>{issueKey}</code> up in. The sixteen issues
              it does carry are on the sprint board, the backlog and the roadmap.
            </PageHeader>
            <Button variant="outline" asChild>
              <Link href="/delivery">Back to the sprint board</Link>
            </Button>
          </Screen>
        </DeskWork>
      </>
    );
  }

  const sprint = sampleSprint(issue.sprintId);
  const outcome = sampleOutcome(outcomeId);
  const done = tasks.filter((task) => task.state === "Done").length;
  const outstanding = tasks.length - done;
  const completingWithOpenTasks = status === "Complete" && outstanding > 0;

  const setTaskState = (taskId: string, next: SampleTaskState) =>
    setTasks((current) =>
      current.map((task) =>
        task.taskId === taskId
          ? // The stamp is the whole completion record — there is no per-task history — and
            // moving off Done clears it, exactly as the domain method does.
            { ...task, state: next, completedOn: next === "Done" ? SAMPLE_TODAY : null }
          : task,
      ),
    );

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTask.trim();
    if (title.length === 0) return;
    setTasks((current) => [
      ...current,
      { taskId: `t-new-${current.length}`, title, state: "Not started", assignee: null, completedOn: null },
    ]);
    setNewTask("");
  };

  const inspector = (
    <Inspector aria-label="Set outcome">
      <InspectorHeader>
        <div className="min-w-0">
          <p className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Set outcome
          </p>
          <InspectorTitle>Which outcome does {issue.key} serve?</InspectorTitle>
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            One outcome per issue. Picking another moves it.
          </p>
        </div>
        <InspectorClose onClick={closePicker} />
      </InspectorHeader>

      <InspectorBody>
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Outcome</legend>
          <RadioGroup value={pending} onValueChange={setPending} className="flex flex-col gap-0 rounded-md border">
            {[...SAMPLE_OUTCOMES.map((one) => ({ id: one.outcomeId, name: one.name, color: one.color })),
              { id: UNGROUPED, name: "Not grouped", color: null as string | null }].map((option) => {
              // This issue's own grouping is read from local state, not from the sample row:
              // after a move the counts have to change, or the alert below claims something
              // the panel can be seen not to do.
              const issues = SAMPLE_ISSUES.filter((one) => {
                const groupedUnder = one.key === issue.key ? outcomeId : one.outcomeId;
                return option.id === UNGROUPED ? groupedUnder === null : groupedUnder === option.id;
              });
              return (
                <div
                  key={option.id}
                  className="flex items-start gap-2 border-t px-3 py-2 first:border-t-0 hover:bg-accent/50"
                >
                  <RadioGroupItem value={option.id} id={`outcome-${option.id}`} className="mt-1" />
                  {/* `Label` is `flex items-center` by default, which would lay the name and
                      its rollup out side by side and wrap both. The two are a heading and its
                      caption, so the column direction is the point, not a preference. */}
                  <Label
                    htmlFor={`outcome-${option.id}`}
                    className="mb-0 min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
                  >
                    <Marker color={option.color} className="font-medium text-foreground" wrap>
                      {option.name}
                    </Marker>
                    <span className="text-xs text-muted-foreground">
                      {option.id === UNGROUPED
                        ? "no outcome, and no bar on the roadmap"
                        : `${issues.length} issues · ${issues.filter((one) => one.deliveryStatus === "Complete").length} done`}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </fieldset>

        {pending !== (outcomeId ?? UNGROUPED) ? (
          <Alert variant="warning" role="status">
            <AlertTitle>This is a move, not an addition.</AlertTitle>
            <AlertDescription>
              {issue.key} leaves{" "}
              <em>{outcome?.name ?? "the ungrouped set"}</em> for{" "}
              <em>{sampleOutcome(pending)?.name ?? "no outcome"}</em>, and the roadmap counts change on
              both rows. That is the honest cost of one home; the roadmap shows it rather than hiding
              it.
            </AlertDescription>
          </Alert>
        ) : null}

        <p className="m-0 text-xs text-muted-foreground">
          In the real feature, changing the outcome writes one audit event
          (<code>IssueOutcomeGroupingChanged</code>) and notifies nobody.
        </p>
      </InspectorBody>

      <InspectorFooter>
        {mutable ? (
          <Button
            className="flex-1"
            onClick={() => {
              setOutcomeId(pending === UNGROUPED ? null : pending);
              closePicker();
            }}
          >
            Move issue
          </Button>
        ) : (
          <PrototypeAction reason={denied ?? "Administrators only"} className="flex-1">
            {(props) => (
              <Button className="flex-1" {...props}>
                Move issue
              </Button>
            )}
          </PrototypeAction>
        )}
        <Button variant="outline" onClick={closePicker}>
          Cancel
        </Button>
      </InspectorFooter>
    </Inspector>
  );

  return (
    <>
      <DeskTopBar
        crumbs={[
          { label: "Delivery", href: "/delivery" },
          // No sprint crumb. Linking it would land on the running sprint's board whatever
          // sprint the issue is in — a per-sprint route is the real feature's job
          // (`/sprints/{sprintId}` in the spec) — and leaving it unlinked gives the trail a
          // second `aria-current="page"`, because `BreadcrumbPage` is what an hrefless crumb
          // renders as. The sprint is on the screen twice already, in the standfirst and in
          // the Delivery panel.
          { label: issue.key },
        ]}
      >
        {/* No Save. Every edit this screen offers — status, task state, outcome — applies as
            it is made, which is what the real screen does too; a Save button here would be a
            control with nothing behind it even once the feature is built. */}
        <Button variant="outline" asChild>
          <Link href="/delivery">Back to the board</Link>
        </Button>
      </DeskTopBar>

      <PrototypeStrip />

      <InspectorLayout open={picking} inspector={inspector}>
        <DeskWork>
          <Screen state={state} data-testid="issue-screen">
            <When state={["normal", "empty"]}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <IssueKey>{issue.key}</IssueKey>
                <Marker color="var(--sky)" className="text-xs">
                  Delivery
                </Marker>
                <EffortMarker effort={issue.effort} withNoun className="text-xs" />
              </div>

              <PageHeader title={issue.title}>
                {status} · {sprint ? sprint.name : "Backlog"} ·{" "}
                {issue.assignees.length > 0
                  ? `assigned to ${issue.assignees.join(" and ")}`
                  : "unassigned"}
              </PageHeader>

              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.35fr_1fr]">
                <div className="flex min-w-0 flex-col gap-4">
                  <Card>
                    <CardContent>
                      <h2 className="m-0 mb-2 text-base font-semibold tracking-tight">Description</h2>
                      <p className="m-0 text-sm leading-relaxed text-foreground/90">
                        {issue.description}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                        <h2 className="m-0 text-base font-semibold tracking-tight">Tasks</h2>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {done} of {tasks.length} done
                        </span>
                      </div>
                      <p className="m-0 mb-3 text-sm text-muted-foreground">
                        The steps that finish this issue, in order. Ticking every box does not complete
                        the issue and an open box does not block it — the checklist informs the
                        standup, it never gates the board.
                      </p>

                      {tasks.length === 0 ? (
                        <p className="m-0 mb-3 text-sm text-muted-foreground">
                          No tasks yet. Break the work into the steps a standup would ask about.
                        </p>
                      ) : (
                        <ul className="m-0 mb-3 list-none divide-y border-y p-0">
                          {tasks.map((task) => (
                            <li key={task.taskId} className="flex items-start gap-3 py-3">
                              {mutable ? (
                                <Select
                                  value={task.state}
                                  onValueChange={(value) =>
                                    setTaskState(task.taskId, value as SampleTaskState)
                                  }
                                >
                                  <SelectTrigger
                                    size="sm"
                                    className="w-32 shrink-0"
                                    aria-label={`State of task: ${task.title}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SAMPLE_TASK_STATES.map((one) => (
                                      <SelectItem key={one} value={one}>
                                        {one}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="w-32 shrink-0 text-xs text-muted-foreground">
                                  {task.state}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`m-0 text-sm ${task.state === "Done" ? "text-muted-foreground line-through" : ""}`}
                                >
                                  {task.title}
                                </p>
                                <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                                  {task.assignee ?? "Unassigned · any active member can take it"}
                                  {task.completedOn ? ` · done ${sampleDate(task.completedOn)}` : ""}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {mutable ? (
                        <form className="flex flex-wrap items-end gap-2" onSubmit={addTask}>
                          <div className="min-w-48 flex-1">
                            <Label htmlFor="delivery-new-task">Add a task</Label>
                            <Input
                              id="delivery-new-task"
                              value={newTask}
                              onChange={(event) => setNewTask(event.target.value)}
                              placeholder="The next step a standup would ask about…"
                            />
                          </div>
                          <Button type="submit" variant="outline">
                            Add task
                          </Button>
                        </form>
                      ) : (
                        <PrototypeAction reason={denied ?? "Only the author, an assignee, or an administrator"}>
                          {(props) => (
                            <Button variant="outline" {...props}>
                              Add task
                            </Button>
                          )}
                        </PrototypeAction>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                        <h2 className="m-0 text-base font-semibold tracking-tight">Discussion</h2>
                        <span className="text-xs text-muted-foreground">
                          {issue.comments.length}{" "}
                          {issue.comments.length === 1 ? "comment" : "comments"} · from the original idea
                        </span>
                      </div>
                      <p className="m-0 mb-3 text-sm text-muted-foreground">
                        The debate that led to the commitment, unchanged and not retyped. Newest last.
                        Posting into it belongs to the idea, not to delivery, so it is read here.
                      </p>
                      {issue.comments.length === 0 ? (
                        <p className="m-0 text-sm text-muted-foreground">
                          This idea was promoted without discussion.
                        </p>
                      ) : (
                        <ul className="m-0 list-none divide-y p-0">
                          {issue.comments.map((comment) => (
                            <li key={comment.commentId} className="py-3 first:pt-0 last:pb-0">
                              <p className="m-0 text-sm font-medium">
                                {comment.author}{" "}
                                <span className="font-normal text-muted-foreground">
                                  {sampleDate(comment.on)}
                                </span>
                              </p>
                              <p className="m-0 mt-1 text-sm text-foreground/90">{comment.body}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <Card>
                    <CardContent>
                      <h2 className="m-0 mb-3 text-base font-semibold tracking-tight">Delivery</h2>
                      <Facts>
                        <Fact label="Status">
                          {mutable ? (
                            <Select
                              value={status}
                              onValueChange={(value) => setStatus(value as SampleDeliveryStatus)}
                            >
                              <SelectTrigger size="sm" className="w-44" aria-label="Delivery status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SAMPLE_DELIVERY_STATUSES.map((one) => (
                                  <SelectItem key={one} value={one}>
                                    {one}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <StatusMarker status={status} />
                          )}
                        </Fact>
                        <Fact label="Sprint">
                          {sprint ? (
                            <span className="flex flex-wrap items-center gap-2">
                              {sprint.name}
                              <SprintStateMarker state={sprint.state} className="text-xs" />
                            </span>
                          ) : (
                            "Backlog"
                          )}
                        </Fact>
                        <Fact label="Effort">
                          <EffortMarker effort={issue.effort} />
                        </Fact>
                        <Fact label="Assigned">
                          <span className="flex flex-wrap items-center gap-2">
                            <SampleAvatars names={issue.assignees} />
                            {issue.assignees.length > 0 ? (
                              <span className="text-sm">{issue.assignees.join(", ")}</span>
                            ) : null}
                          </span>
                        </Fact>
                        <Fact label="Outcome">
                          <span className="flex flex-wrap items-center gap-2">
                            {outcome ? (
                              <Marker color={outcome.color} wrap>
                                {outcome.name}
                              </Marker>
                            ) : (
                              <span className="text-muted-foreground">Not grouped</span>
                            )}
                            <Button
                              ref={changeRef}
                              size="sm"
                              variant="outline"
                              aria-expanded={picking}
                              onClick={() => {
                                setPending(outcomeId ?? UNGROUPED);
                                setPicking(true);
                              }}
                            >
                              Change
                            </Button>
                          </span>
                        </Fact>
                        <Fact label="Tasks">
                          <TaskProgress done={done} total={tasks.length} />
                        </Fact>
                      </Facts>

                      {completingWithOpenTasks ? (
                        <Alert variant="warning" role="status" className="mt-3">
                          <AlertTitle>
                            {outstanding} {outstanding === 1 ? "task is" : "tasks are"} still open.
                          </AlertTitle>
                          <AlertDescription>
                            Complete is allowed anyway — the checklist warns, it never blocks. Enforcing
                            &ldquo;all tasks done&rdquo; would make it a gate, which this feature
                            refuses.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <p className="m-0 mt-3 text-xs text-muted-foreground">
                        The real screen also lets the idea&rsquo;s author and any assignee change the
                        status. This prototype has no viewer identity to match against invented data,
                        so it gates on administrator alone.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <h2 className="m-0 mb-1 text-base font-semibold tracking-tight">Provenance</h2>
                      <p className="m-0 mb-3 text-sm text-muted-foreground">
                        Where this work came from. Nothing here is retyped; it is the idea&rsquo;s own
                        record, because the issue is the idea.
                      </p>
                      <p className="m-0 mb-3 text-sm text-foreground/80">
                        Originated as an idea by <strong>{issue.author}</strong> on{" "}
                        <strong>{sampleDate(issue.raisedOn)}</strong> · <strong>{issue.upvotesAtPromotion}</strong>{" "}
                        upvotes at promotion (<strong>{issue.upvotes}</strong> now) · promoted by{" "}
                        <strong>{issue.promotedBy}</strong> on <strong>{sampleDate(issue.promotedOn)}</strong>.
                      </p>
                      <Facts>
                        <Fact label="Type">{issue.ideaType}</Fact>
                        <Fact label="Impact">{issue.businessImpact}</Fact>
                        <Fact label="Idea status">
                          <span className="flex flex-wrap items-center gap-2">
                            {issue.ideaStatus}
                            <span className="text-xs text-muted-foreground">kept for history</span>
                          </span>
                        </Fact>
                        <Fact label="Tags">
                          <TagRow tags={issue.tags} />
                        </Fact>
                      </Facts>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <h2 className="m-0 mb-1 text-base font-semibold tracking-tight">
                        Return to discovery
                      </h2>
                      <p className="m-0 mb-3 text-sm text-muted-foreground">
                        Undo a mistaken promotion. The issue leaves its sprint and goes back to the
                        ideas board; its effort, its tasks and the promotion record are all kept, so
                        promoting it again loses nothing.
                      </p>
                      <PrototypeAction reason={mutable ? undefined : (denied ?? "Administrators only")}>
                        {(props) => (
                          <Button variant="outline" {...props}>
                            Return to discovery
                          </Button>
                        )}
                      </PrototypeAction>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </When>

            <When state="loading">
              <p className="text-sm text-muted-foreground">Loading the issue…</p>
            </When>

            <When state="error">
              <Alert variant="destructive">
                <AlertTitle>Couldn&rsquo;t load this issue.</AlertTitle>
                <AlertDescription>Nothing has been changed. Retrying is safe.</AlertDescription>
              </Alert>
            </When>
          </Screen>
        </DeskWork>
      </InspectorLayout>
    </>
  );
}
