"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Input,
  InspectorLayout,
  Label,
  Pagination,
  PaginationNext,
  PaginationPrevious,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  cn,
} from "@collega/design-system";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Assignees } from "@/components/desk/assignees";
import { IdeaInspector } from "@/components/desk/idea-inspector";
import { Marker } from "@/components/desk/marker";
import { CreateIdeaPanel, NewIdeaAction } from "@/components/desk/new-idea";
import { CorpusNote, ErrorNotice, LoadingRows, RefusalNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { queryWasIgnored, useApi } from "@/lib/api";
import { PRIORITY_COLORS, assigneeName, shortDate } from "@/lib/format";
import { useActivateOnSpace, useCloseOnEscape } from "@/lib/keys";
import type { IdeaListItem, Paged } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/**
 * The organization-wide idea list.
 *
 * **What the recordings can and cannot do, because it shapes the whole screen.** The corpus
 * holds exactly one capture of `GET /organizations/{id}/ideas`: page 1, twenty of twenty-two
 * rows, no query string. It never recorded a filter, a sort or a second page. So the filters
 * and the sort below narrow and order *the recorded page, in the browser* — which is real
 * work on real data — and the screen says so rather than implying the API was asked. Paging
 * and page size do go to the API, because stepping outside the recording is worth being able
 * to see: the mock answers with the page it has and flags that it ignored the query, and the
 * note that appears is the honest report of a hole in the corpus.
 *
 * When Nest is behind this, filtering and sorting move into the query string and the note
 * disappears with the mock. The screen is written so that is a change to `useApi`'s path and
 * nothing else.
 */

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "Created by me" },
  { value: "assigned", label: "Assigned to me" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];
type SortKey = "title" | "created";

const PAGE_SIZES = [20, 25, 50, 100, 250];

export function IdeasScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const activateOnSpace = useActivateOnSpace();
  const { me, organizationId, organization, boards, statuses, ideaTypes, stateOverride } = useWorkspace();

  const [scope, setScope] = React.useState<Scope>("all");
  const [search, setSearch] = React.useState("");
  const [boardFilter, setBoardFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState<{ key: SortKey; descending: boolean }>({
    key: "created",
    descending: true,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number | null>(null);

  // No query string at all on the first request: that is the shape the corpus recorded, and
  // it is the difference between an exact match and a note saying the query was ignored.
  const query = new URLSearchParams();
  if (page !== 1) query.set("page", String(page));
  if (pageSize !== null) query.set("pageSize", String(pageSize));
  const suffix = query.size > 0 ? `?${query}` : "";

  const ideas = useApi<Paged<IdeaListItem>>(
    organizationId ? `/organizations/${organizationId}/ideas${suffix}` : null,
  );

  const items = ideas.data?.items ?? [];
  const boardList = boards.data ?? [];
  const boardsById = new Map(boardList.map((board) => [board.boardId, board]));
  const statusesById = new Map(statuses.map((status) => [status.statusId, status]));

  const visible = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matches = items.filter((idea) => {
      if (boardFilter !== "all" && idea.boardId !== boardFilter) return false;
      if (typeFilter !== "all" && idea.ideaTypeId !== typeFilter) return false;
      if (statusFilter !== "all" && idea.statusId !== statusFilter) return false;
      if (scope === "mine" && idea.authorUserId !== me?.userId) return false;
      if (scope === "assigned" && !idea.assignees.some((one) => one.userId === me?.userId)) return false;
      if (needle.length === 0) return true;
      return [
        idea.title,
        idea.statusName,
        idea.ideaTypeName,
        idea.businessImpactName ?? "",
        ...idea.tagNames,
        ...idea.assignees.map(assigneeName),
      ].some((field) => field.toLowerCase().includes(needle));
    });

    const direction = sort.descending ? -1 : 1;
    return [...matches].sort((a, b) =>
      sort.key === "title"
        ? direction * a.title.localeCompare(b.title)
        : direction * a.createdAtUtc.localeCompare(b.createdAtUtc),
    );
  }, [items, search, boardFilter, typeFilter, statusFilter, scope, sort, me?.userId]);

  const narrowed = visible.length !== items.length;
  const selectedId = params.get("idea");
  const selected = items.find((idea) => idea.ideaId === selectedId) ?? null;
  const creating = params.get("create") === "1";
  const columnOpen = selected !== null || creating;
  const closeColumn = React.useCallback(() => router.push("/ideas"), [router]);
  useCloseOnEscape(columnOpen, closeColumn);

  const state: ScreenState =
    stateOverride ??
    (ideas.state === "loading"
      ? "loading"
      : ideas.state === "error"
        ? "error"
        : visible.length === 0
          ? "empty"
          : "normal");

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onClick={() => setSort((current) => ({ key, descending: current.key === key ? !current.descending : true }))}
    >
      {label}
      <span aria-hidden="true">{sort.key === key ? (sort.descending ? "↓" : "↑") : ""}</span>
    </button>
  );

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    sort.key !== key ? "none" : sort.descending ? "descending" : "ascending";

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Ideas" }]}>
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
        <NewIdeaAction href="/ideas?create=1" />
      </DeskTopBar>

      <InspectorLayout
        open={columnOpen}
        inspector={
          creating ? (
            <CreateIdeaPanel boardName={boardList[0]?.name ?? "the board"} onClose={closeColumn} />
          ) : selected ? (
            <IdeaInspector
              idea={selected}
              boardName={boardsById.get(selected.boardId)?.name ?? "Unknown board"}
              status={statusesById.get(selected.statusId)}
              onClose={closeColumn}
            />
          ) : null
        }
      >
        <DeskWork>
          <PageHeader title="Ideas">
            {me?.role === "SiteAdmin"
              ? "Every idea in the organization you are browsing, read-only from here. Act as a member to change one."
              : `Every idea in ${organization?.title ?? "your organization"}, across all boards.`}
          </PageHeader>

          <form
            className="mb-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => event.preventDefault()}
            role="search"
          >
            <div className="min-w-60 flex-1">
              <Label htmlFor="ideas-search">Search</Label>
              <Input
                id="ideas-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, tag, status, type or assignee…"
              />
            </div>
            <div className="min-w-40">
              <Label htmlFor="ideas-board">Board</Label>
              <Select value={boardFilter} onValueChange={setBoardFilter}>
                <SelectTrigger id="ideas-board">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All boards</SelectItem>
                  {boardList.map((board) => (
                    <SelectItem key={board.boardId} value={board.boardId}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-40">
              <Label htmlFor="ideas-type">Idea type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="ideas-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ideaTypes.map((type) => (
                    <SelectItem key={type.ideaTypeId} value={type.ideaTypeId}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-40">
              <Label htmlFor="ideas-status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="ideas-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.statusId} value={status.statusId}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setBoardFilter("all");
                setTypeFilter("all");
                setStatusFilter("all");
                setScope("all");
              }}
            >
              Clear filters
            </Button>
          </form>

          {narrowed ? (
            <CorpusNote className="mb-4">
              the corpus captured this list once, unfiltered — so the filters above narrow the
              recorded page in the browser rather than asking the API. {visible.length} of{" "}
              {items.length} recorded rows match.
            </CorpusNote>
          ) : null}

          {queryWasIgnored(ideas.mock) ? (
            <CorpusNote className="mb-4">
              the corpus holds only page 1 of this list at the recorded page size, so the API
              answered the request for page {page}
              {pageSize === null ? "" : ` at ${pageSize} per page`} with the page it has. Nothing
              beyond the capture exists to show.
            </CorpusNote>
          ) : null}

          <Screen state={state} data-testid="ideas-screen">
            <When state="loading">
              <LoadingRows rows={8} />
            </When>

            <When state="error">
              {ideas.error?.isRefusal ? (
                <RefusalNotice error={ideas.error} />
              ) : ideas.error?.isMockGap ? (
                <CorpusNote>{ideas.error.message}</CorpusNote>
              ) : (
                <ErrorNotice error={ideas.error} what="ideas" onRetry={ideas.reload} />
              )}
            </When>

            <When state="empty">
              <Empty>
                <EmptyTitle>No ideas match this filter</EmptyTitle>
                <EmptyDescription>Try a different filter, or clear the search.</EmptyDescription>
              </Empty>
            </When>

            <When state="normal">
              <Card className="gap-0 overflow-hidden py-0">
                {/* `relative` so the table's own scroll container is the containing block
                    for the absolutely positioned `sr-only` text inside it, and clips it. */}
                <div className="relative overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[38%] min-w-56" aria-sort={ariaSort("title")}>
                          {sortButton("title", "Title")}
                        </TableHead>
                        <TableHead className="hidden min-w-40 md:table-cell">Type</TableHead>
                        <TableHead className="min-w-36">Status</TableHead>
                        <TableHead className="hidden min-w-24 lg:table-cell">Priority</TableHead>
                        <TableHead className="hidden min-w-24 lg:table-cell">Assigned</TableHead>
                        <TableHead className="hidden min-w-24 md:table-cell" aria-sort={ariaSort("created")}>
                          {sortButton("created", "Created")}
                        </TableHead>
                        <TableHead className="hidden w-16 text-right lg:table-cell">Votes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((idea) => (
                        <TableRow
                          key={idea.ideaId}
                          data-selected={idea.ideaId === selectedId || undefined}
                          className={cn(
                            idea.ideaId === selectedId &&
                              "bg-accent shadow-[inset_3px_0_0_0_var(--primary)]",
                          )}
                        >
                          <TableCell>
                            <Link
                              href={`/ideas?idea=${idea.ideaId}`}
                              onKeyDown={activateOnSpace}
                              className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              {idea.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{boardsById.get(idea.boardId)?.name ?? "Unknown board"}</span>
                              {[...idea.tagNames].sort().slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                              {idea.tagNames.length > 3 ? (
                                <span>+{idea.tagNames.length - 3}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Marker color={idea.ideaTypeColorHex}>{idea.ideaTypeName}</Marker>
                          </TableCell>
                          <TableCell>
                            <Marker color={statusesById.get(idea.statusId)?.color}>{idea.statusName}</Marker>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Marker color={PRIORITY_COLORS[idea.priority]}>{idea.priority}</Marker>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Assignees assignees={idea.assignees} />
                          </TableCell>
                          <TableCell className="hidden tabular-nums md:table-cell">
                            {shortDate(idea.createdAtUtc)}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">
                            {idea.upvoteCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Pagination>
                  {/* Two different denominators, and conflating them is how a count lies:
                      unfiltered, the page is a slice of the API's total; filtered, it is a
                      slice of what came back, because the filtering happened here. */}
                  <span className="tabular-nums">
                    {narrowed
                      ? `Showing ${visible.length} of ${items.length} on this page`
                      : `Showing ${visible.length} of ${ideas.data?.totalCount ?? visible.length}`}
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <Label htmlFor="ideas-page-size" className="mb-0 text-sm font-normal">
                      Rows per page
                    </Label>
                    <Select
                      value={String(pageSize ?? ideas.data?.pageSize ?? 20)}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger id="ideas-page-size" size="sm" className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <PaginationPrevious
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    />
                    <PaginationNext
                      disabled={
                        ideas.data === null || page * (ideas.data.pageSize || 1) >= ideas.data.totalCount
                      }
                      onClick={() => setPage((current) => current + 1)}
                    />
                  </span>
                </Pagination>
              </Card>
            </When>
          </Screen>

          {selectedId !== null && selected === null && ideas.state === "ready" ? (
            <Alert className="mt-4">
              <AlertTitle>That idea is not on this page</AlertTitle>
              <AlertDescription>
                The link points at an idea the recorded page does not contain, so there is
                nothing to open.
              </AlertDescription>
            </Alert>
          ) : null}
        </DeskWork>
      </InspectorLayout>
    </>
  );
}
