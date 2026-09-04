"use client";

/**
 * Create and edit a board — one component behind four routes, as `BoardEdit.razor` was:
 * new or existing, own organization or organization-scoped.
 *
 * **The refusal is the form's absence, not a dead Save.** A Site Admin reaching any of these
 * routes gets the reason and a way out, never the form — comp P carries the original's own
 * words for why: *"never the form, which would otherwise render empty below the message and
 * offer a Save that cannot work."* This is `SPEC/20-feature-view-as.md` rule 25 at the one
 * place where the whole screen is a mutation.
 *
 * The two-swimlane floor is a real rule the API enforces — the corpus recorded
 * `POST /organizations/{id}/boards` with one swimlane as a 400. At the floor, Remove is
 * refused rather than removed, so the rule is discoverable at the point it bites.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Input,
  Label,
  Screen,
  Skeleton,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
import { PageHeader } from "@/components/desk/page-header";
import { useApi } from "@/lib/api";
import type { BoardDetail, Role, Status } from "@/lib/types";

import { Cols, SubmitOutcome } from "@/app/(desk)/settings/_components/chrome";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { mayMutate, refusalReason } from "@/app/(desk)/settings/_lib/rules";

const FLOOR = 2;

export function BoardFormScreen({
  role,
  organizationId,
  organizationName,
  boardId,
  backHref,
  override,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  /** Null for the create route. */
  boardId: string | null;
  backHref: string;
  override: "empty" | "loading" | "error" | null;
}) {
  const mutable = mayMutate(role, "org-content");
  const board = useApi<BoardDetail>(boardId ? `/boards/${boardId}` : null);
  const statuses = useApi<Status[]>(
    organizationId ? `/organizations/${organizationId}/statuses` : null,
  );
  const save = useSubmit<BoardDetail>();

  const [name, setName] = React.useState<string | null>(null);
  const [allowMoves, setAllowMoves] = React.useState<boolean | null>(null);
  const [lanes, setLanes] = React.useState<readonly string[] | null>(null);

  const allStatuses = React.useMemo(
    () => [...(statuses.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [statuses.data],
  );

  // Seeded from the board when there is one, then owned by the form. Reading through a
  // fallback rather than syncing in an effect keeps the first paint correct.
  const nameValue = name ?? board.data?.name ?? "";
  const allowValue = allowMoves ?? board.data?.allowUserStatusUpdate ?? true;
  const laneIds =
    lanes ??
    (board.data
      ? [...board.data.swimlanes].sort((a, b) => a.order - b.order).map((lane) => lane.statusId)
      : allStatuses.slice(0, FLOOR).map((status) => status.statusId));

  const statusById = new Map(allStatuses.map((status) => [status.statusId, status]));
  const available = allStatuses.filter((status) => !laneIds.includes(status.statusId));
  const atFloor = laneIds.length <= FLOOR;

  const move = (index: number, delta: number) => {
    setLanes(() => {
      const next = [...laneIds];
      const target = index + delta;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  if (role === undefined) return null;

  if (!mutable) {
    return (
      <>
        <PageHeader title="Not available">{organizationName} · read access only.</PageHeader>
        <Empty data-testid="settings-board-refused">
          <EmptyTitle>A Site Admin cannot create or change a board</EmptyTitle>
          <EmptyDescription>
            <>
              Boards are organization-owned content, and a Site Admin is refused every mutation
              of it. {refusalReason(role, "org-content")} Reading a board is fine; saving is
              not, so the form is absent rather than present and doomed.
            </>
          </EmptyDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={backHref}>Back to boards</Link>
            </Button>
          </div>
        </Empty>
      </>
    );
  }

  const state: ScreenState =
    override ??
    (statuses.state === "loading" || (boardId !== null && board.state === "loading")
      ? "loading"
      : statuses.state === "error" || (boardId !== null && board.state === "error")
        ? "error"
        : "normal");

  return (
    <>
      <PageHeader title={boardId ? "Edit board" : "New board"}>
        {boardId
          ? `${nameValue || "This board"} · ${laneIds.length} swimlanes, drawn from this organization’s statuses.`
          : "Name it, then choose which of this organization’s statuses become its columns."}
      </PageHeader>

      <Screen state={state} data-testid="settings-board-form">
        <When state="loading">
          <Card className="max-w-[720px]">
            <CardContent className="flex flex-col gap-3">
              <span className="sr-only">Loading</span>
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </CardContent>
          </Card>
        </When>

        <When state="error">
          <Alert variant="destructive">
            <AlertTitle>Couldn’t load this board.</AlertTitle>
            <AlertDescription>
              {board.error?.message ?? statuses.error?.message ?? "Retrying is safe."}
            </AlertDescription>
          </Alert>
        </When>

        <When state={["normal", "empty"]}>
          <Cols
            aside={
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <h2 className="m-0 text-lg font-semibold tracking-tight">
                    {boardId ? "Edit board" : "New board"}
                  </h2>
                  <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                    A board groups ideas into columns. Which columns, and in what order, is
                    what makes two boards in the same organization different from each other —
                    they draw from one shared set of statuses.
                  </p>
                  <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                    Removing a swimlane does not delete the status, and does not delete the
                    ideas sitting in it. Those ideas keep their status; they simply stop
                    appearing on this board until the lane comes back.
                  </p>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardContent>
                <form
                  className="flex flex-col gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!organizationId) return;
                    const body = {
                      name: nameValue,
                      allowUserStatusUpdate: allowValue,
                      swimlanes: laneIds.map((statusId, order) => ({ statusId, order })),
                    };
                    void (boardId
                      ? save.send("PUT", `/boards/${boardId}`, body)
                      : save.send("POST", `/organizations/${organizationId}/boards`, body));
                  }}
                >
                  <div className="max-w-md">
                    <Label htmlFor="settings-board-name">
                      Name <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="settings-board-name"
                      required
                      value={nameValue}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>

                  <div>
                    <label className="flex items-start gap-2 text-sm" htmlFor="settings-board-moves">
                      <Checkbox
                        id="settings-board-moves"
                        checked={allowValue}
                        aria-describedby="settings-board-moves-hint"
                        onCheckedChange={(value) => setAllowMoves(value === true)}
                      />
                      Let Users move ideas between statuses on this board
                    </label>
                    <p
                      id="settings-board-moves-hint"
                      className="mt-1 mb-0 pl-6 text-xs text-muted-foreground"
                    >
                      With this off, only administrators can change an idea’s status here. Read
                      Only accounts can never move anything, on any board.
                    </p>
                  </div>

                  <fieldset className="m-0 border-0 p-0">
                    <legend className="mb-1 text-base font-semibold">Swimlanes</legend>
                    <p className="mt-0 mb-3 text-xs text-muted-foreground">
                      Pick from this organization’s statuses. The order on the left is the
                      left-to-right order of the board’s columns.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="mt-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          On this board — in order
                        </h3>
                        <ul className="m-0 flex list-none flex-col gap-1 p-0">
                          {laneIds.map((statusId, index) => {
                            const status = statusById.get(statusId);
                            const label = status?.name ?? "Unknown status";
                            return (
                              <li
                                key={statusId}
                                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                              >
                                <Marker color={status?.color} className="min-w-0 flex-1">
                                  {label}
                                </Marker>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Move ${label} up`}
                                  {...(index === 0
                                    ? {
                                        "aria-disabled": true as const,
                                        "aria-describedby": "settings-board-first",
                                      }
                                    : {})}
                                  onClick={() => index > 0 && move(index, -1)}
                                >
                                  <span aria-hidden="true">↑</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Move ${label} down`}
                                  {...(index === laneIds.length - 1
                                    ? {
                                        "aria-disabled": true as const,
                                        "aria-describedby": "settings-board-last",
                                      }
                                    : {})}
                                  onClick={() => index < laneIds.length - 1 && move(index, 1)}
                                >
                                  <span aria-hidden="true">↓</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  {...(atFloor
                                    ? {
                                        "aria-disabled": true as const,
                                        "aria-describedby": "settings-board-floor",
                                      }
                                    : {})}
                                  onClick={() =>
                                    !atFloor &&
                                    setLanes(laneIds.filter((id) => id !== statusId))
                                  }
                                >
                                  Remove<span className="sr-only"> {label}</span>
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                        {atFloor ? (
                          <p
                            id="settings-board-floor"
                            className="mt-2 mb-0 text-xs text-muted-foreground italic"
                          >
                            A board needs at least two swimlanes, so the last two cannot be
                            removed. Add a third to free them.
                          </p>
                        ) : null}
                        {/* Visually hidden: a greyed arrow at the top of a list explains
                            itself to anyone who can see where it sits. */}
                        <span id="settings-board-first" className="sr-only">
                          Already first in the order.
                        </span>
                        <span id="settings-board-last" className="sr-only">
                          Already last in the order.
                        </span>
                      </div>

                      <div>
                        <h3 className="mt-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Available statuses
                        </h3>
                        {available.length === 0 ? (
                          <p className="m-0 text-sm text-muted-foreground">
                            Every status is already a lane on this board.
                          </p>
                        ) : (
                          <ul className="m-0 flex list-none flex-col gap-1 p-0">
                            {available.map((status) => (
                              <li
                                key={status.statusId}
                                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                              >
                                <Marker color={status.color} className="min-w-0 flex-1">
                                  {status.name}
                                </Marker>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLanes([...laneIds, status.statusId])}
                                >
                                  Add<span className="sr-only"> {status.name}</span>
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </fieldset>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={save.state === "sending"}>
                      {boardId ? "Save changes" : "Create board"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={backHref}>Cancel</Link>
                    </Button>
                  </div>
                </form>

                <SubmitOutcome outcome={save} what="save" className="mt-4" />
              </CardContent>
            </Card>
          </Cols>
        </When>
      </Screen>
    </>
  );
}
