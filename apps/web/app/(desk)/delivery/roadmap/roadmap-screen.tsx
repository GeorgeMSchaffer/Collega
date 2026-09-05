"use client";

/**
 * The roadmap: outcomes as rows against a quarter or sprint axis.
 *
 * **Single-parent is the whole design here.** `SPEC/decisions.md` 2026-09-02 settled Outcome ↔
 * Issue cardinality at *at most one*, and it is settled — comp P renders multi-parent
 * affordances in places and the decision supersedes it. What that buys is arithmetic that is
 * honest by construction: the rows partition the delivery set, so every number below is a
 * plain count, the ledger under the grid adds up, and nothing needs a distinct-count beside
 * it. The ledger is rendered from the same derivation as the rows rather than typed in, which
 * is the only way it can be trusted to keep adding up.
 *
 * Every rollup — issue count, done count, sprint span, quarter placement — is derived at read
 * time. The spec forbids storing any of them, and an Outcome has no status field and no
 * percent-complete field to render even if one wanted to.
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
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
  StatusMarker,
} from "@/app/(desk)/delivery/_prototype/chrome";
import {
  SAMPLE_ISSUES,
  SAMPLE_OUTCOMES,
  SAMPLE_SPRINTS,
  sampleQuarterOf,
  sampleSprint,
  type SampleIssue,
  type SampleOutcome,
} from "@/app/(desk)/delivery/_prototype/sample-data";

type Axis = "quarter" | "sprint";

/** A column of the grid: a quarter, or a single sprint. */
interface Bucket {
  readonly id: string;
  readonly label: string;
}

/** Sprints in date order — the order both axes are built from. */
const SPRINTS_BY_DATE = [...SAMPLE_SPRINTS].sort((a, b) => a.startDate.localeCompare(b.startDate));

const QUARTER_BUCKETS: readonly Bucket[] = SPRINTS_BY_DATE.reduce<Bucket[]>((buckets, sprint) => {
  const label = sampleQuarterOf(sprint.startDate);
  return buckets.some((bucket) => bucket.id === label) ? buckets : [...buckets, { id: label, label }];
}, []);

const SPRINT_BUCKETS: readonly Bucket[] = SPRINTS_BY_DATE.map((sprint) => ({
  id: sprint.sprintId,
  label: sprint.name,
}));

/** Which bucket a sprint falls in, on the given axis. */
function bucketOf(sprintId: string, axis: Axis): string | null {
  const sprint = sampleSprint(sprintId);
  if (!sprint) return null;
  return axis === "sprint" ? sprint.sprintId : sampleQuarterOf(sprint.startDate);
}

/** "Sprints 11–12" from a set of sprint names, or "Sprint 12" for one. */
function spanLabel(sprintIds: readonly string[]): string {
  const names = SPRINTS_BY_DATE.filter((sprint) => sprintIds.includes(sprint.sprintId)).map(
    (sprint) => sprint.name,
  );
  const first = names.at(0);
  const last = names.at(-1);
  if (first === undefined || last === undefined) return "";
  if (first === last) return first;
  return `Sprints ${first.replace(/^Sprint /, "")}–${last.replace(/^Sprint /, "")}`;
}

/**
 * On the sprint axis a cell is one sprint, so it says how many of the row's issues sit in it.
 * The singular is written out: "1 issues" is the tell that a count was concatenated rather
 * than worded, and this prototype exists to be read closely.
 */
function issuesInCell(row: Row, sprintIds: readonly string[]): string {
  const count = row.issues.filter((issue) =>
    issue.sprintId !== null && sprintIds.includes(issue.sprintId),
  ).length;
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

interface Row {
  readonly outcome: SampleOutcome | null;
  readonly issues: readonly SampleIssue[];
  readonly done: number;
  /** Sprint ids per bucket id, in date order. Absent bucket = no bar. */
  readonly cells: ReadonlyMap<string, readonly string[]>;
  readonly span: string;
}

function buildRow(outcome: SampleOutcome | null, issues: readonly SampleIssue[], axis: Axis): Row {
  const cells = new Map<string, string[]>();
  for (const sprint of SPRINTS_BY_DATE) {
    if (!issues.some((issue) => issue.sprintId === sprint.sprintId)) continue;
    const bucket = bucketOf(sprint.sprintId, axis);
    if (!bucket) continue;
    cells.set(bucket, [...(cells.get(bucket) ?? []), sprint.sprintId]);
  }
  const allSprints = [...cells.values()].flat();
  return {
    outcome,
    issues,
    done: issues.filter((issue) => issue.deliveryStatus === "Complete").length,
    cells,
    span: spanLabel(allSprints),
  };
}

export function RoadmapScreen() {
  const { me, stateOverride } = useWorkspace();
  const activateOnSpace = useActivateOnSpace();
  const mutable = mayMutate(me?.role, "org-content");
  const denied = refusalReason(me?.role, "org-content");

  const [axis, setAxis] = React.useState<Axis>("quarter");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const buckets = axis === "quarter" ? QUARTER_BUCKETS : SPRINT_BUCKETS;

  const rows = React.useMemo(
    () =>
      SAMPLE_OUTCOMES.map((outcome) =>
        buildRow(
          outcome,
          SAMPLE_ISSUES.filter((issue) => issue.outcomeId === outcome.outcomeId),
          axis,
        ),
      ),
    [axis],
  );
  const ungrouped = React.useMemo(
    () => buildRow(null, SAMPLE_ISSUES.filter((issue) => issue.outcomeId === null), axis),
    [axis],
  );

  const grouped = rows.reduce((total, row) => total + row.issues.length, 0);
  const total = SAMPLE_ISSUES.length;

  const state: ScreenState = stateOverride ?? (SAMPLE_OUTCOMES.length === 0 ? "empty" : "normal");

  const detailId = (key: string) => `roadmap-issues-${key}`;

  const renderRow = (row: Row, key: string) => {
    const name = row.outcome?.name ?? "Not grouped";
    const open = expanded === key;
    return (
      <React.Fragment key={key}>
        <TableRow>
          <TableCell className="align-top">
            <Marker
              color={row.outcome?.color ?? null}
              className="font-medium text-foreground"
              wrap
            >
              {name}
            </Marker>
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              {row.issues.length} {row.issues.length === 1 ? "issue" : "issues"} · {row.done} done
              {row.span ? ` · ${row.span}` : " · no sprint yet"}
            </p>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId(key)}
              onClick={() => setExpanded(open ? null : key)}
              className="mt-1 text-xs font-medium text-foreground underline underline-offset-2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              {open ? "Hide" : "Show"} issues<span className="sr-only"> under {name}</span>
            </button>
          </TableCell>
          {buckets.map((bucket) => {
            const sprintIds = row.cells.get(bucket.id);
            return (
              <TableCell key={bucket.id} className="align-top">
                {sprintIds ? (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted px-2 py-0.5 text-xs font-medium">
                    <Marker color={row.outcome?.color ?? null}>
                      <span className="text-xs">
                        {axis === "quarter" ? spanLabel(sprintIds) : issuesInCell(row, sprintIds)}
                      </span>
                    </Marker>
                  </span>
                ) : null}
              </TableCell>
            );
          })}
        </TableRow>
        <TableRow id={detailId(key)} hidden={!open}>
          <TableCell colSpan={buckets.length + 1} className="bg-muted/40">
            {row.issues.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">No issues under this outcome.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {row.issues.map((issue) => (
                  <li key={issue.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <IssueKey>{issue.key}</IssueKey>
                    <Link
                      href={`/delivery/issues/${issue.key}`}
                      onKeyDown={activateOnSpace}
                      className="text-sm font-medium text-foreground hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {issue.title}
                    </Link>
                    <StatusMarker status={issue.deliveryStatus} className="text-xs" />
                    <EffortMarker effort={issue.effort} withNoun className="text-xs" />
                    <span className="text-xs text-muted-foreground">
                      {sampleSprint(issue.sprintId)?.name ?? "Backlog"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  };

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Delivery" }, { label: "Roadmap" }]}>
        <ToggleGroup
          type="single"
          aria-label="Time axis"
          value={axis}
          onValueChange={(value) => value && setAxis(value as Axis)}
        >
          <ToggleGroupItem value="quarter">Quarters</ToggleGroupItem>
          <ToggleGroupItem value="sprint">Sprints</ToggleGroupItem>
        </ToggleGroup>
        <PrototypeAction reason={mutable ? undefined : (denied ?? "Administrators only")}>
          {(props) => <Button {...props}>Add outcome</Button>}
        </PrototypeAction>
      </DeskTopBar>

      <PrototypeStrip />

      <DeskWork>
        <PageHeader title="Roadmap">
          What the quarter is for. Each outcome groups the issues that serve it, and an issue sits
          under at most one outcome — so every count here is a plain count and the rows add up to the
          delivery set rather than covering it twice.
        </PageHeader>

        <Screen state={state} data-testid="roadmap-screen">
          <When state="loading">
            <div className="rounded-xl border bg-card p-4">
              <span className="sr-only">Loading the roadmap</span>
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="mt-4 h-3 first:mt-0" style={{ width: `${80 - row * 8}%` }} />
              ))}
            </div>
          </When>

          <When state="error">
            <ErrorNotice what="the roadmap" />
          </When>

          <When state="empty">
            <Empty>
              <EmptyTitle>No outcomes yet</EmptyTitle>
              <EmptyDescription>
                An outcome is a named, dated theme — &ldquo;cut reporting effort&rdquo; — that issues
                are grouped under. It is a lens, never a container: it never owns an issue, and
                deleting one ungroups its issues rather than touching them.
              </EmptyDescription>
            </Empty>
          </When>

          <When state="normal">
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Delivery issues",
                  value: total,
                  detail: "across every sprint and the backlog",
                },
                {
                  label: "Grouped",
                  value: grouped,
                  detail: `under ${SAMPLE_OUTCOMES.length} outcomes, each counted once`,
                },
                {
                  label: "Not grouped",
                  value: ungrouped.issues.length,
                  detail: "committed work serving no stated outcome yet",
                },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardContent>
                    <p className="m-0 text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">{kpi.value}</p>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">{kpi.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64 min-w-56">Outcome</TableHead>
                    {buckets.map((bucket) => (
                      <TableHead key={bucket.id} className="min-w-36">
                        {bucket.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => renderRow(row, row.outcome?.outcomeId ?? "none"))}
                  {renderRow(ungrouped, "ungrouped")}
                </TableBody>
              </Table>
              <p className="m-0 flex flex-wrap gap-x-6 gap-y-1 border-t bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
                <span>
                  {SAMPLE_OUTCOMES.length} outcomes · rows sum to <strong>{grouped}</strong>
                </span>
                <span>
                  + {ungrouped.issues.length} not grouped = <strong>{grouped + ungrouped.issues.length}</strong>
                </span>
                <span>
                  <strong>
                    {grouped + ungrouped.issues.length === total
                      ? "= the delivery set"
                      : `≠ the delivery set (${total})`}
                  </strong>
                </span>
              </p>
            </div>

            <Card className="mt-4">
              <CardContent>
                <h2 className="m-0 mb-2 text-base font-semibold tracking-tight">
                  A partition, not a cover
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                  Because an issue has at most one outcome, the rows and the ungrouped row add up to
                  the {total} delivery issues with nothing counted twice, so no total needs a
                  distinct-count beside it. A row&rsquo;s span is drawn only from its own
                  issues&rsquo; sprints, which is why a row can have a gap in it — a real gap, not a
                  rendering artefact. The dot names the row and is always beside its label; no bar
                  carries meaning in its fill.
                </p>
              </CardContent>
            </Card>
          </When>
        </Screen>
      </DeskWork>
    </>
  );
}
