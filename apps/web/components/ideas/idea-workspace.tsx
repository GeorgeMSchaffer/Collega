'use client'

import { Alert, EffortBar, TagChip } from '@collega/design-system'
import { useMemo, useOptimistic, useState, useTransition } from 'react'
import {
  type Column,
  ConfirmDialog,
  DataTable,
  ListToolbar,
  MultiSelectFilter,
  Pager,
  RowActions,
  useListState,
  ViewSwitch,
} from '@/components/list'
import { engagementDenial, mayDeleteIdeas, mayEditIdeaContent, writeDenial } from '@/lib/roles'
import { reorderLanes } from '@/lib/server/board-actions'
import { deleteIdea } from '@/lib/server/idea-actions'
import { useCurrentUser } from '@/lib/session-client'
import type { BoardRef, Idea, IdeaDetail, IdeaFormOptions, Status, TagRef } from '@/lib/types'
import { People, PriorityMarker, StatusMarker, TagList } from './idea-chips'
import { type DrawerMode, IdeaDrawer } from './idea-drawer'
import { BOARD_LIST, IDEAS_LIST, PRIORITIES } from './idea-list-config'
import { Lane, type LaneReorder } from './lane'
import { useDrawerUrl } from './use-drawer-url'

type BoardContext = {
  id: string
  name: string
  lanes: Status[]
  isArchived: boolean
  /** The role and the board's `allowUserStatusUpdate`, decided by the page. */
  canMove: boolean
  /** Whether the lane headers carry move left / right: an Org Admin's, hidden for other roles. */
  canReorder: boolean
}

type Removing = { id: string; title: string; boardId: string }

/**
 * An idea list on the comp R pattern — the Ideas page (`board` null: List or Cards) or a board's own
 * page (Lanes or List) — with the idea drawer over it.
 *
 * Presentational over what the server page fetched: the rows are already the page the URL asks for,
 * filtered, sorted and paged by the API, so changing the list state here only rewrites the URL and
 * the page re-reads. What a row lets the reader do is decided from the role and the idea's board
 * (archived boards are read-only), and hidden rather than disabled where it may not (the Denied
 * rule's row-action exception).
 */
export function IdeaWorkspace({
  rows,
  total,
  boards,
  statuses,
  tags,
  board,
  drawer,
}: {
  rows: Idea[]
  total: number
  /** Every board the rows may be on, archived included. */
  boards: BoardRef[]
  /** The Status filter's options and colours: the organization's, or the board's own lanes. */
  statuses: Status[]
  /** The Tags filter's options: the organization's whole catalog. */
  tags: TagRef[]
  board: BoardContext | null
  drawer: { mode: DrawerMode | null; idea: IdeaDetail | null; formOptions: IdeaFormOptions | null }
}) {
  const user = useCurrentUser()
  const config = board ? BOARD_LIST : IDEAS_LIST
  const [state, update] = useListState(config)
  const openDrawer = useDrawerUrl()

  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [removing, setRemoving] = useState<Removing | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  // The lane order as last saved, or as the reorder in flight has it. A refusal ends the transition
  // with `board.lanes` unchanged, so the columns fall back on their own; a save revalidates the
  // page and `board.lanes` arrives in the new order.
  const [lanes, setLanes] = useOptimistic(board?.lanes ?? [])
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [reordering, startReorder] = useTransition()
  // What the polite live region last said about a lane move; screen readers hear the new position.
  const [reorderNews, setReorderNews] = useState('')

  // The lane being dragged by its header, and the lane it is over; both null outside a drag.
  const [draggingLane, setDraggingLane] = useState<string | null>(null)
  const [overLane, setOverLane] = useState<string | null>(null)

  const moveLane = (from: number, to: number) => {
    if (!board || from === to) return
    const next = [...lanes]
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    setReorderNews('')
    startReorder(async () => {
      setLanes(next)
      const result = await reorderLanes(
        board.id,
        next.map((lane) => lane.id),
      )
      setReorderError(result.error)
      if (!result.error) {
        setReorderNews(`${moved.name} moved to position ${to + 1} of ${next.length}`)
      }
    })
  }

  const boardsById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses])

  const denial = writeDenial(user.role)
  const archived = (boardId: string) => boardsById.get(boardId)?.isArchived ?? false
  const canEdit = (idea: { boardId: string }) => denial === null && !archived(idea.boardId)
  const canDelete = (idea: { boardId: string }) =>
    mayDeleteIdeas(user.role) && !archived(idea.boardId)
  const engagement = engagementDenial(user.role)

  const drawerOpen = drawer.mode !== null
  const view = (ideaId: string, from: HTMLElement) => {
    if (!drawerOpen) setTrigger(from)
    openDrawer({ view: ideaId })
  }
  const edit = (ideaId: string, from: HTMLElement) => {
    if (!drawerOpen) setTrigger(from)
    openDrawer({ edit: ideaId })
  }

  const confirmRemove = () => {
    if (!removing) return
    startDelete(async () => {
      const result = await deleteIdea(removing.id, removing.boardId)
      setRemoveError(result.error)
      if (!result.error && drawer.idea?.id === removing.id) openDrawer(null)
      setRemoving(null)
    })
  }

  const selectedTags = state.filters.tag ?? []
  // The filter is by name. A selected name the catalog no longer has (a link to a deleted tag) stays
  // an option, so it can be cleared.
  const tagOptions = [
    ...tags.map((tag) => ({
      value: tag.name,
      label: tag.name,
      display: <TagChip color={tag.color}>{tag.name}</TagChip>,
    })),
    ...selectedTags
      .filter((name) => !tags.some((tag) => tag.name === name))
      .map((name) => ({ value: name, label: name })),
  ]

  const filtering = state.q !== '' || Object.values(state.filters).some((v) => v.length > 0)
  const empty = filtering ? 'Nothing matches these filters.' : 'No ideas yet.'
  const selectedId =
    drawer.mode === 'view' || drawer.mode === 'edit' ? (drawer.idea?.id ?? null) : null

  const actions = (idea: Idea) => (
    <RowActions
      itemLabel={idea.title}
      onView={(from) => view(idea.id, from)}
      onEdit={(from) => edit(idea.id, from)}
      onRemove={() => setRemoving({ id: idea.id, title: idea.title, boardId: idea.boardId })}
      canEdit={canEdit(idea)}
      canRemove={canDelete(idea)}
    />
  )

  const boardName = (boardId: string) => boardsById.get(boardId)?.name ?? board?.name ?? ''

  const columns: Column<Idea>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (idea) => (
        <>
          <button
            type="button"
            onClick={(event) => view(idea.id, event.currentTarget)}
            className="text-left font-semibold hover:text-accent-foreground hover:underline"
          >
            {idea.title}
          </button>
          {idea.effort ? <EffortBar effort={idea.effort} className="mt-1 flex w-fit" /> : null}
        </>
      ),
    },
    ...(board
      ? []
      : [
          {
            key: 'board',
            header: 'Board',
            cell: (idea: Idea) => (
              <>
                {boardName(idea.boardId)}
                {boardsById.get(idea.boardId)?.isArchived ? (
                  <span className="block text-xs text-muted-foreground">Archived</span>
                ) : null}
              </>
            ),
          },
        ]),
    {
      key: 'status',
      header: 'Status',
      cell: (idea) => (
        <StatusMarker name={idea.statusName} color={statusById.get(idea.statusId)?.color} />
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      cell: (idea) => <PriorityMarker priority={idea.priority} />,
    },
    { key: 'assignedTo', header: 'Assignees', cell: (idea) => <People people={idea.assignees} /> },
    { key: 'tags', header: 'Tags', cell: (idea) => <TagList tags={idea.tags} max={2} /> },
    { key: 'upvoteCount', header: 'Votes', numeric: true, cell: (idea) => idea.upvotes },
  ]

  const drawerIdea = drawer.idea
  const drawerBoardId = drawerIdea?.boardId ?? board?.id ?? null
  // An `&edit=1` link to an idea this reader may not edit opens it to read instead.
  const drawerMode =
    drawer.mode === 'edit' && drawerIdea && !canEdit(drawerIdea) ? 'view' : drawer.mode

  return (
    <>
      <ListToolbar
        query={state.q}
        onQueryChange={(q) => update({ q })}
        placeholder={`Filter by title, ${board ? '' : 'board, '}status, priority, tag, person, problem…`}
        end={
          <ViewSwitch
            views={config.views ?? []}
            value={state.view}
            onChange={(next) => update({ view: next, page: state.page })}
          />
        }
      >
        {board ? null : (
          <MultiSelectFilter
            label="Board"
            options={boards.map((b) => ({
              value: b.id,
              label: b.isArchived ? `${b.name} (archived)` : b.name,
            }))}
            selected={state.filters.board ?? []}
            onChange={(next) => update({ filters: { ...state.filters, board: next } })}
          />
        )}
        <MultiSelectFilter
          label="Status"
          options={statuses.map((s) => ({ value: s.id, label: s.name }))}
          selected={state.filters.status ?? []}
          onChange={(next) => update({ filters: { ...state.filters, status: next } })}
        />
        <MultiSelectFilter
          label="Priority"
          options={PRIORITIES}
          selected={state.filters.priority ?? []}
          onChange={(next) => update({ filters: { ...state.filters, priority: next } })}
        />
        <MultiSelectFilter
          label="Tags"
          options={tagOptions}
          selected={selectedTags}
          onChange={(next) => update({ filters: { ...state.filters, tag: next } })}
        />
      </ListToolbar>

      {removeError ? (
        <Alert variant="destructive" role="alert">
          <span>{removeError}</span>
        </Alert>
      ) : null}

      {state.view === 'lanes' && board ? (
        <>
          {board.canReorder ? (
            <p role="status" className="sr-only">
              {reorderNews}
            </p>
          ) : null}
          {board.canReorder && board.isArchived ? (
            <p id="why-reorder-lanes" className="m-0 text-xs italic text-muted-foreground">
              This board is archived, so its lanes keep their order until it is unarchived.
            </p>
          ) : null}
          {reorderError ? (
            <Alert variant="destructive" role="alert">
              <span>{reorderError}</span>
            </Alert>
          ) : null}
          {total > rows.length ? (
            <p className="m-0 text-sm text-muted-foreground">
              Showing the first {rows.length} of {total} ideas. Filter to narrow the board, or
              switch to List to page through all of them.
            </p>
          ) : null}
          <div
            aria-busy={reordering || undefined}
            className="grid gap-2.5 overflow-x-auto pb-3"
            style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(200px, 1fr))` }}
          >
            {lanes.map((status, index) => (
              <Lane
                key={status.id}
                status={status}
                boardId={board.id}
                ideas={rows.filter((idea) => idea.statusId === status.id)}
                previousStatusId={lanes[index - 1]?.id ?? null}
                nextStatusId={lanes[index + 1]?.id ?? null}
                canMove={board.canMove}
                upvoteDenial={engagement}
                selectedId={selectedId}
                onOpen={view}
                reorder={
                  board.canReorder
                    ? ({
                        denialId: board.isArchived ? 'why-reorder-lanes' : null,
                        pending: reordering,
                        onMove: (delta) => moveLane(index, index + delta),
                        dragging: draggingLane === status.id,
                        over: draggingLane !== null && overLane === status.id,
                        onDragStart: () => setDraggingLane(status.id),
                        onDragEnd: () => {
                          setDraggingLane(null)
                          setOverLane(null)
                        },
                        onDragOver: () => {
                          if (draggingLane === null) return false
                          setOverLane(status.id)
                          return true
                        },
                        onDragLeave: () =>
                          setOverLane((current) => (current === status.id ? null : current)),
                        onDrop: () => {
                          const from = lanes.findIndex((lane) => lane.id === draggingLane)
                          setDraggingLane(null)
                          setOverLane(null)
                          if (from >= 0) moveLane(from, index)
                        },
                      } satisfies LaneReorder)
                    : null
                }
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {state.view === 'cards' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3.5">
              {rows.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">{empty}</p>
              ) : (
                rows.map((idea) => (
                  <article
                    key={idea.id}
                    aria-current={selectedId === idea.id ? 'true' : undefined}
                    className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3.5 aria-[current]:border-primary"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={(event) => view(idea.id, event.currentTarget)}
                        className="text-left font-semibold hover:text-accent-foreground hover:underline"
                      >
                        {idea.title}
                      </button>
                      <span className="text-xs font-semibold tabular-nums">
                        <span aria-hidden="true">▲</span> {idea.upvotes}
                        <span className="sr-only"> votes</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusMarker
                        name={idea.statusName}
                        color={statusById.get(idea.statusId)?.color}
                      />
                      <PriorityMarker priority={idea.priority} />
                      {idea.effort ? <EffortBar effort={idea.effort} /> : null}
                    </div>
                    <TagList tags={idea.tags} />
                    <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span className="truncate">{boardName(idea.boardId)}</span>
                        <People people={idea.assignees} quiet />
                      </span>
                      {actions(idea)}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : (
            <DataTable
              caption={board ? `Ideas on ${board.name}` : 'Ideas'}
              columns={columns}
              rows={rows}
              rowKey={(idea) => idea.id}
              sort={state.sort}
              onSortChange={(sort) => update({ sort })}
              actions={actions}
              empty={empty}
              selectedKey={selectedId}
            />
          )}
          <Pager
            page={state.page}
            size={state.size}
            total={total}
            onPageChange={(page) => update({ page })}
            onSizeChange={(size) => update({ size })}
          />
        </>
      )}

      <IdeaDrawer
        mode={drawerMode}
        idea={drawerIdea}
        boardName={drawerBoardId ? boardName(drawerBoardId) : null}
        statusColor={drawerIdea ? statusById.get(drawerIdea.statusId)?.color : undefined}
        formOptions={drawer.formOptions}
        createBoards={board ? null : boards}
        createBoardId={board?.id ?? null}
        canEdit={drawerIdea ? canEdit(drawerIdea) : false}
        canDelete={drawerIdea ? canDelete(drawerIdea) : false}
        contentLocked={
          drawerIdea ? !mayEditIdeaContent(user.role, user.userId, drawerIdea.authorUserId) : false
        }
        engagementDenial={engagement}
        returnFocusTo={trigger}
        onEdit={() => drawerIdea && openDrawer({ edit: drawerIdea.id })}
        onView={() => drawerIdea && openDrawer({ view: drawerIdea.id })}
        onClose={() => {
          openDrawer(null)
          setTrigger(null)
        }}
        onDelete={() =>
          drawerIdea &&
          setRemoving({ id: drawerIdea.id, title: drawerIdea.title, boardId: drawerIdea.boardId })
        }
        onSaved={(ideaId) => openDrawer({ view: ideaId })}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Delete this idea?"
        description={`“${removing?.title ?? ''}” leaves its board and Ideas. This can’t be undone.`}
        confirmLabel="Delete idea"
        pending={deleting}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  )
}
