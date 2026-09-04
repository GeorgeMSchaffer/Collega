"use client";

import {
  Button,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Input,
  InspectorLayout,
  Label,
  Screen,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  When,
  type ScreenState,
} from "@collega/design-system";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { LaneCard } from "@/app/(desk)/board/[boardId]/lane-card";
import { IdeaInspector } from "@/components/desk/idea-inspector";
import { Marker } from "@/components/desk/marker";
import { CreateIdeaPanel, NewIdeaAction } from "@/components/desk/new-idea";
import { CorpusNote, ErrorNotice, RefusalNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { API_BASE_URL } from "@/mocks";
import { pathWasSubstituted, useApi } from "@/lib/api";
import { assigneeName } from "@/lib/format";
import { useCloseOnEscape } from "@/lib/keys";
import type { BoardDetail, IdeaListItem, Paged, Status } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/**
 * The board: ideas as cards in swimlane columns, one column per status, ordered by sort order.
 *
 * **Where the lanes come from, and why it is not simply the board record.** `GET /boards/{id}`
 * was captured against one board only — the throwaway board the capture itself created — so
 * asking it about any other board gets that board's two swimlanes back under a
 * `substituted` flag. Serving those as this board's lanes would be a lie with a straight
 * face. So the lanes are taken from the board record when the mock says the answer is an
 * exact recording of *this* board, and from the organization's status list, which is an exact
 * recording either way, when it is not — with the substitution stated on screen.
 *
 * Filtering and search are client-side, which is what the spec asks for on this screen and
 * also all the corpus can support: `GET /boards/{id}/ideas` was recorded once, unfiltered.
 */

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "Created by me" },
  { value: "assigned", label: "Assigned to me" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];

export function BoardScreen({ boardId }: { boardId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { me, boards, statuses, stateOverride } = useWorkspace();

  const [scope, setScope] = React.useState<Scope>("all");
  const [search, setSearch] = React.useState("");

  const board = useApi<BoardDetail>(`/boards/${boardId}`);
  const ideas = useApi<Paged<IdeaListItem>>(`/boards/${boardId}/ideas`);

  const summary = (boards.data ?? []).find((one) => one.boardId === boardId);
  const lanesAreSubstituted = pathWasSubstituted(board.mock);
  const cardsAreSubstituted = pathWasSubstituted(ideas.mock);

  // The board record is only this board's when the mock says it is an exact recording;
  // otherwise it describes some other board and neither its name nor its settings may be
  // borrowed. The board list is exact for every role, so that is the source when it has it.
  const exactBoard = lanesAreSubstituted ? null : board.data;
  const boardName = summary?.name ?? exactBoard?.name ?? "Board";

  // Exact recording of this board: its own swimlanes. Otherwise the organization's statuses,
  // which is what a board's lanes are drawn from and is recorded exactly for every role.
  const lanes: readonly Status[] = React.useMemo(() => {
    if (exactBoard) {
      return [...exactBoard.swimlanes]
        .sort((a, b) => a.order - b.order)
        .map((lane) => ({
          statusId: lane.statusId,
          name: lane.statusName,
          color: lane.statusColor,
          sortOrder: lane.order,
          isDeleted: lane.statusIsDeleted,
        }));
    }
    return statuses;
  }, [exactBoard, statuses]);

  // `?? []` would mint a fresh array every render, so the memo below would recompute
  // on every keystroke rather than only when the data changes.
  const items = React.useMemo(() => ideas.data?.items ?? [], [ideas.data]);
  const visible = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((idea) => {
      if (scope === "mine" && idea.authorUserId !== me?.userId) return false;
      if (scope === "assigned" && !idea.assignees.some((one) => one.userId === me?.userId)) return false;
      if (needle.length === 0) return true;
      return [idea.title, ...idea.tagNames, ...idea.assignees.map(assigneeName)].some((field) =>
        field.toLowerCase().includes(needle),
      );
    });
  }, [items, scope, search, me?.userId]);

  const selectedId = params.get("idea");
  const selected = items.find((idea) => idea.ideaId === selectedId) ?? null;
  const creating = params.get("create") === "1";
  const columnOpen = selected !== null || creating;
  const closeColumn = React.useCallback(() => router.push(`/board/${boardId}`), [router, boardId]);
  useCloseOnEscape(columnOpen, closeColumn);

  const state: ScreenState =
    stateOverride ??
    (ideas.state === "loading" || board.state === "loading"
      ? "loading"
      : ideas.state === "error"
        ? "error"
        : visible.length === 0
          ? "empty"
          : "normal");

  const canMove = summary?.allowUserStatusUpdate ?? exactBoard?.allowUserStatusUpdate ?? false;
  const isViewer = me?.role === "ReadOnly" || me?.role === "SiteAdmin";

  const lane = (status: Status, cards: readonly IdeaListItem[], children?: React.ReactNode) => (
    <section
      key={status.statusId}
      aria-label={`${status.name}, ${cards.length} ideas`}
      className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2"
    >
      <h2 className="flex items-center gap-2 px-2 pt-1 pb-2 text-sm">
        <Marker color={status.color} className="font-medium">
          {status.name}
        </Marker>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{cards.length}</span>
      </h2>
      <div className="flex flex-col gap-2">
        {cards.map((idea) => (
          <LaneCard
            key={idea.ideaId}
            idea={idea}
            href={`/board/${boardId}?idea=${idea.ideaId}`}
            selected={idea.ideaId === selectedId}
          />
        ))}
        {children}
      </div>
    </section>
  );

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Boards", href: "/boards" }, { label: boardName }]}>
        <ToggleGroup type="single" aria-label="View" value="lanes">
          <ToggleGroupItem value="list" asChild>
            <Link href="/ideas">List</Link>
          </ToggleGroupItem>
          <ToggleGroupItem value="lanes">Lanes</ToggleGroupItem>
        </ToggleGroup>
        {/* Through API_BASE_URL like every other call, so the cutover in mocks/config.ts
            moves this with the rest instead of leaving it pointed at the retired mock. */}
        <Button variant="outline" asChild>
          <a href={`${API_BASE_URL}/boards/${boardId}/ideas/export`} download>
            Export CSV
          </a>
        </Button>
        <NewIdeaAction href={`/board/${boardId}?create=1`} />
      </DeskTopBar>

      <InspectorLayout
        open={columnOpen}
        inspector={
          creating ? (
            <CreateIdeaPanel boardName={boardName} onClose={closeColumn} />
          ) : selected ? (
            <IdeaInspector
              idea={selected}
              boardName={boardName}
              status={lanes.find((one) => one.statusId === selected.statusId)}
              onClose={closeColumn}
            />
          ) : null
        }
      >
        <DeskWork>
          {/* The header states what a viewer can actually do here. Moving a card — by drag
              or by the ← → keyboard equivalent the spec requires alongside it — belongs to
              the engagement slice, and promising it before it exists costs a keyboard user
              a wasted attempt, so the sentence says where movement lives today instead. */}
          <PageHeader title={boardName}>
            {isViewer
              ? "Cards open read-only for your role, and nothing here can be moved. Export is still yours — the CSV is a read."
              : canMove
                ? "Members may move cards on this board. Moving one — by drag or with ← → on a focused card — arrives with the next slice; until then a card's status is read here and changed nowhere."
                : "An administrator has turned off card movement on this board."}
          </PageHeader>

          <form
            className="mb-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => event.preventDefault()}
            role="search"
          >
            <div className="min-w-60 flex-1">
              <Label htmlFor="board-search">Search</Label>
              <Input
                id="board-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, tag, assignee…"
              />
            </div>
            <ToggleGroup
              type="single"
              aria-label="Scope"
              value={scope}
              onValueChange={(value) => value && setScope(value as Scope)}
            >
              {SCOPES.map((one) => (
                <ToggleGroupItem key={one.value} value={one.value}>
                  {one.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setScope("all");
              }}
            >
              Clear
            </Button>
          </form>

          {lanesAreSubstituted ? (
            <CorpusNote className="mb-4">
              the corpus recorded <code>GET /boards/{"{"}boardId{"}"}</code> against one board only, so
              this board&rsquo;s own swimlanes were never captured. The lanes below are the
              organization&rsquo;s statuses in sort order, which is a recording, and{" "}
              {summary ? `the board reports ${summary.swimlaneCount} swimlanes` : "the board list agrees on the count"}.
            </CorpusNote>
          ) : null}

          {cardsAreSubstituted ? (
            <CorpusNote className="mb-4">
              the ideas below were recorded against{" "}
              <code>{ideas.mock?.recordedPath ?? "another board"}</code>, not this board. The corpus
              captured one board&rsquo;s ideas, so these cards are real rows belonging somewhere else
              — treat the layout as the subject, not the contents.
            </CorpusNote>
          ) : null}

          <Screen state={state} data-testid="board-screen">
            <When state="loading">
              {/* `relative` is load-bearing, not decoration. Tailwind's `sr-only` is
                  `position: absolute`, and an absolutely positioned element is only clipped
                  by an ancestor's overflow if that ancestor is its containing block —
                  otherwise the visually hidden text on the off-screen lanes sits at its
                  static position and gives the *page* a horizontal scrollbar. The rail
                  scrolls; the page never does. */}
              <div className="relative flex items-start gap-3 overflow-x-auto pb-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2">
                    <span className="sr-only">Loading lanes</span>
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
              {ideas.error?.isRefusal ? (
                <RefusalNotice error={ideas.error} />
              ) : ideas.error?.isMockGap ? (
                <CorpusNote>{ideas.error.message}</CorpusNote>
              ) : (
                <ErrorNotice error={ideas.error} what="this board" onRetry={ideas.reload} />
              )}
            </When>

            {/* Empty columns stay visible with their placeholder — the rail is the board's
                shape, and it does not change because a filter matched nothing. */}
            <When state={["empty", "normal"]}>
              {/* `relative` is load-bearing, not decoration. Tailwind's `sr-only` is
                  `position: absolute`, and an absolutely positioned element is only clipped
                  by an ancestor's overflow if that ancestor is its containing block —
                  otherwise the visually hidden text on the off-screen lanes sits at its
                  static position and gives the *page* a horizontal scrollbar. The rail
                  scrolls; the page never does. */}
              <div className="relative flex items-start gap-3 overflow-x-auto pb-3">
                {lanes.map((status) =>
                  lane(
                    status,
                    visible.filter((idea) => idea.statusId === status.statusId),
                    visible.some((idea) => idea.statusId === status.statusId) ? null : (
                      <p className="m-0 px-2 py-3 text-xs text-muted-foreground">No ideas</p>
                    ),
                  ),
                )}
              </div>
            </When>

            <When state="empty">
              <Empty className="mt-4">
                <EmptyTitle>Nothing matches on this board</EmptyTitle>
                <EmptyDescription>
                  Clear the search, or widen the scope back to all ideas.
                </EmptyDescription>
              </Empty>
            </When>
          </Screen>
        </DeskWork>
      </InspectorLayout>
    </>
  );
}
