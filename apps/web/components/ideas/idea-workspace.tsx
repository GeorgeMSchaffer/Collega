'use client'

import { Alert, Button, EffortBar, TagChip } from '@collega/design-system'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'
import {
  type Column,
  ConfirmDialog,
  DataTable,
  ListToolbar,
  MultiSelectFilter,
  Pager,
  QuickAddBar,
  type QuickAddValues,
  RowActions,
  useAddedHighlight,
  useListState,
  ViewSwitch,
} from '@/components/list'
import { Icon } from '@/components/list/icons'
import {
  blockedBadge,
  blockedTooltip,
  isBlockedHere,
  moveRefusal,
  NO_EFFORT_TEXT,
  openTaskCount,
  progressPercent,
  rollupText,
  type WorkLane,
  waitingText,
} from '@/lib/board-work'
import { TITLE_MAX_LENGTH } from '@/lib/limits'
import {
  detachOffer,
  engagementDenial,
  followDenial,
  mayDeleteIdeas,
  mayEditIdeaContent,
  writeDenial,
} from '@/lib/roles'
import { reorderLanes } from '@/lib/server/board-actions'
import { deleteIdea, detachIdea, moveIdea } from '@/lib/server/idea-actions'
import { useCurrentUser } from '@/lib/session-client'
import type {
  BoardRef,
  Idea,
  IdeaBlockers,
  IdeaDetail,
  IdeaFormOptions,
  IdeaTasks,
  Status,
  TagRef,
} from '@/lib/types'
import type { CardWork } from './idea-card'
import { People, PriorityMarker, StatusMarker, TagList } from './idea-chips'
import { type DrawerMode, IdeaDrawer } from './idea-drawer'
import { BOARD_LIST, IDEAS_LIST, PHASES, PRIORITIES, SCOPES } from './idea-list-config'
import { type CardDrag, Lane, type LaneReorder } from './lane'
import { MoveAnywayDialog } from './move-anyway-dialog'
import { RemoveFromBoardButton } from './remove-from-board'
import { useDrawerUrl } from './use-drawer-url'

type BoardContext = {
  id: string
  name: string
  /** With the Board References flags when the page read them; a lane without them is ordinary. */
  lanes: WorkLane[]
  /**
   * The board each reference lane hands work to, by id: its name, and the key prefix its pill
   * shows ("IMPL"). A board with no prefix shows its name.
   */
  referenceBoards?: Readonly<Record<string, { name: string; label: string }>>
  isArchived: boolean
  /** The role and the board's `allowUserStatusUpdate`, decided by the page. */
  canMove: boolean
  /** Whether the lane headers carry move left / right: an Org Admin's, hidden for other roles. */
  canReorder: boolean
}

type Removing = { id: string; title: string; boardId: string | null }

/** An idea whose Remove from board is awaiting its confirm. */
type Detaching = { id: string; title: string; boardId: string; boardName: string }

/**
 * An Org Admin's override of the reference-lane lock, awaiting its reason: a move to `toLane`, or
 * Remove from board. `openTasks` and `referencedBoard` are what the card showed when it was asked.
 */
type Forcing = {
  idea: { id: string; title: string; itemKey: string | null; boardId: string | null }
  openTasks: number
  /** The board the tasks live on, when the lane that holds the card says which. */
  referencedBoard: string | null
} & ({ kind: 'move'; toLane: WorkLane } | { kind: 'remove'; boardId: string; boardName: string })

/**
 * The override dialog's body, from the decided copy (`decisions.md` 2026-10-16, point 3). The comp
 * lists the open tasks under it; no read returns them yet, so the count stands in for "these".
 */
function forcingBody(forcing: Forcing | null): string {
  if (!forcing) return ''
  const { idea, openTasks, referencedBoard } = forcing
  const tasks = `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'}`
  const named = `‘${idea.title}’${idea.itemKey ? ` (${idea.itemKey})` : ''} is waiting on ${tasks}.`
  const left = referencedBoard ? `the ${referencedBoard} board` : 'their own board'
  return forcing.kind === 'move'
    ? `${named} Moving it leaves them open on ${left}.`
    : `${named} Removing it from ${forcing.boardName} leaves them open on ${left}.`
}

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
  issueIds = [],
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
  drawer: {
    mode: DrawerMode | null
    idea: IdeaDetail | null
    formOptions: IdeaFormOptions | null
    /** The open idea is in Delivery, which the detail does not say. */
    isIssue?: boolean
    assistAvailable?: boolean
    tasks?: IdeaTasks | null
    blockers?: IdeaBlockers | null
  }
  /** Which of `rows` are Issues, which the list items do not say. */
  issueIds?: readonly string[]
}) {
  const user = useCurrentUser()
  const config = board ? BOARD_LIST : IDEAS_LIST
  const [state, update] = useListState(config)
  const openDrawer = useDrawerUrl()
  // The quick-add row's Title, handed to the create form; spent once the form is open.
  const [prefill, setPrefill] = useState<{ title: string } | null>(null)
  const quickAdded = useRef(false)

  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [removing, setRemoving] = useState<Removing | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const [detaching, setDetaching] = useState<Detaching | null>(null)
  const [detachError, setDetachError] = useState<string | null>(null)
  const [detachPending, startDetach] = useTransition()
  const [forcing, setForcing] = useState<Forcing | null>(null)
  // A move refused for a missing Effort: the card, and the lane it was headed for.
  const [effortFix, setEffortFix] = useState<{
    ideaId: string
    title: string
    laneName: string
  } | null>(null)
  const [forcePending, startForce] = useTransition()

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

  // The cards as last saved, or as the move in flight has them. A refusal ends the transition with
  // `rows` unchanged, so the card falls back on its own; a save revalidates and `rows` arrives moved.
  const [laneRows, setCardLane] = useOptimistic(
    rows,
    (current, move: { ideaId: string; statusId: string; statusName: string }) =>
      current.map((idea) =>
        idea.id === move.ideaId
          ? { ...idea, statusId: move.statusId, statusName: move.statusName }
          : idea,
      ),
  )
  const [moveError, setMoveError] = useState<string | null>(null)
  const [movingCard, startCardMove] = useTransition()
  // What the polite live region last said about a card move.
  const [cardNews, setCardNews] = useState('')
  // The card a keypress moved. It lands in another lane's list, so React remounts it and focus
  // drops to <body>; the layout effect puts focus back on its title before paint. The flag stays up
  // until the save settles, so a refusal that moves the card back is covered too.
  const refocusCard = useRef<string | null>(null)
  // The card being dragged by its handle, and the lane it is over; both null outside a drag.
  const [draggingCard, setDraggingCard] = useState<{ id: string; statusId: string } | null>(null)
  const [overCardLane, setOverCardLane] = useState<string | null>(null)

  // The same `moveIdea` the card's arrows submit, so one rule decides what a move may do.
  const moveCard = (
    ideaId: string,
    boardId: string,
    to: WorkLane,
    announce?: string,
    forceReason?: string,
  ) => {
    const form = new FormData()
    form.set('boardId', boardId)
    form.set('ideaId', ideaId)
    form.set('statusId', to.id)
    // What the card shows, so a refusal that still arrives from the API can name it.
    const idea = laneRows.find((row) => row.id === ideaId)
    if (idea) {
      form.set('title', idea.title)
      const open = openTaskCount(
        idea,
        lanes.find((lane) => lane.id === idea.statusId),
      )
      if (open > 0) form.set('openTasks', String(open))
      const blockers = idea.blockedBy.filter((blocker) => !blocker.isFinal).length
      if (blockers > 0) form.set('blockers', String(blockers))
    }
    if (forceReason) form.set('forceReason', forceReason)
    setMoveError(null)
    startCardMove(async () => {
      setCardLane({ ideaId, statusId: to.id, statusName: to.name })
      const result = await moveIdea({ error: null }, form)
      setMoveError(result.error)
      if (announce && !result.error) setCardNews(`${announce} moved to ${to.name}`)
    })
  }

  const keyMoveCard = (ideaId: string, toStatusId: string) => {
    const to = lanes.find((lane) => lane.id === toStatusId)
    const idea = laneRows.find((row) => row.id === ideaId)
    // The card sits in its optimistic lane, so a press before the save settles moves it on from there.
    if (!board || !to || !idea) return
    // The same refusals the drop and the arrows give, said aloud: nothing is sent.
    const refusal = moveRefusal(idea, lanes, to.id)
    if (refusal) {
      setMoveError(null)
      setCardNews(`${idea.title} can’t move to ${to.name}. ${refusal}`)
      if (refusal === NO_EFFORT_TEXT) {
        setEffortFix({ ideaId: idea.id, title: idea.title, laneName: to.name })
      }
      return
    }
    refocusCard.current = ideaId
    setCardNews('')
    moveCard(ideaId, board.id, to, idea.title)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: the rows are the trigger, not an input
  useLayoutEffect(() => {
    const id = refocusCard.current
    const active = document.activeElement
    if (id && (active === null || active === document.body)) {
      document.querySelector<HTMLButtonElement>(`[data-idea-title="${CSS.escape(id)}"]`)?.focus()
    }
  }, [laneRows])
  useLayoutEffect(() => {
    if (!movingCard) refocusCard.current = null
  }, [movingCard])

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

  // What Board References adds to a card in `lanes[index]`: the lock, the rollup, a blocker, and
  // which neighbouring lane refuses it. An Org Admin's way past the lock goes to the next lane, or
  // the previous one at the board's end.
  const workFor = (idea: Idea, index: number): CardWork => {
    const lane = lanes[index]
    const open = openTaskCount(idea, lane)
    const blockedHere = isBlockedHere(idea, lanes)
    const previous = lanes[index - 1]
    const next = lanes[index + 1]
    const target = next ?? previous
    const referenced = lane?.referencesBoardId
      ? (board?.referenceBoards?.[lane.referencesBoardId]?.name ?? null)
      : null
    return {
      lockText: open > 0 ? waitingText(open) : null,
      rollup: lane?.referencesBoardId ? rollupText(idea.taskCounts) : null,
      progress: progressPercent(idea.taskCounts),
      blockedText: blockedHere ? blockedBadge(idea) : null,
      blockedTip: blockedHere ? blockedTooltip(idea) : null,
      previousRefusal: previous ? moveRefusal(idea, lanes, previous.id) : null,
      nextRefusal: next ? moveRefusal(idea, lanes, next.id) : null,
      openTasks: open,
      blockers: idea.blockedBy.filter((blocker) => !blocker.isFinal).length,
      onMoveAnyway:
        open > 0 && user.role === 'OrgAdmin' && board?.canMove && target
          ? () =>
              setForcing({
                kind: 'move',
                idea: {
                  id: idea.id,
                  title: idea.title,
                  itemKey: idea.itemKey,
                  boardId: idea.boardId,
                },
                openTasks: open,
                referencedBoard: referenced,
                toLane: target,
              })
          : null,
    }
  }

  const confirmForce = (reason: string, laneId: string | null) => {
    if (!forcing) return
    const current = forcing
    if (current.kind === 'move') {
      // The card moves through the same optimistic path as any other; its transition is the pending.
      setForcing(null)
      const to = lanes.find((lane) => lane.id === laneId) ?? current.toLane
      if (board) moveCard(current.idea.id, board.id, to, undefined, reason)
      return
    }
    startForce(async () => {
      const result = await detachIdea(current.idea.id, current.boardId, {
        forceReason: reason,
        title: current.idea.title,
        openTasks: current.openTasks,
      })
      setDetachError(result.error)
      setForcing(null)
    })
  }

  const boardsById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses])

  const denial = writeDenial(user.role)
  const archived = (boardId: string | null) =>
    boardId ? (boardsById.get(boardId)?.isArchived ?? false) : false
  const canEdit = (idea: { boardId: string | null }) => denial === null && !archived(idea.boardId)
  const canDelete = (idea: { boardId: string | null }) =>
    mayDeleteIdeas(user.role) && !archived(idea.boardId)
  const engagement = engagementDenial(user.role)
  // Whoever sees the page header's Add New Idea: a role that may write, on a board not archived.
  const canAdd = denial === null && !board?.isArchived
  const rowIds = rows.map((row) => row.id).join(',')
  const highlight = useAddedHighlight(rowIds)
  const applied = useCallback(() => setPrefill(null), [])

  // The form has read `initial` on mounting, so the Title is spent once it is open.
  const createOpen = drawer.mode === 'create' && drawer.formOptions !== null
  useEffect(() => {
    if (prefill && createOpen) applied()
  }, [prefill, createOpen, applied])

  const handoff = (values: QuickAddValues) => {
    setPrefill({ title: values.title ?? '' })
    quickAdded.current = true
    openDrawer({ create: true })
  }

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
      const result = await deleteIdea(removing.id, removing.boardId ?? '')
      setRemoveError(result.error)
      if (!result.error && drawer.idea?.id === removing.id) openDrawer(null)
      setRemoving(null)
    })
  }

  const confirmDetach = () => {
    if (!detaching) return
    startDetach(async () => {
      const result = await detachIdea(detaching.id, detaching.boardId)
      setDetachError(result.error)
      setDetaching(null)
    })
  }

  const issues = new Set(issueIds)
  const offerDetach = (idea: Idea, isIssue: boolean) =>
    detachOffer(user.role, user.userId, idea, { isIssue, boardArchived: archived(idea.boardId) })
  const detachButton = (
    idea: Pick<Idea, 'id' | 'title' | 'boardId' | 'itemKey' | 'taskCounts'>,
    offer: { reason: string | null; override?: boolean },
  ) => (
    <RemoveFromBoardButton
      title={idea.title}
      offer={offer}
      onOverride={() => {
        if (!idea.boardId || !idea.taskCounts) return
        setDetachError(null)
        setForcing({
          kind: 'remove',
          idea: { id: idea.id, title: idea.title, itemKey: idea.itemKey, boardId: idea.boardId },
          openTasks: Math.max(0, idea.taskCounts.total - idea.taskCounts.done),
          referencedBoard: null,
          boardId: idea.boardId,
          boardName: boardName(idea.boardId),
        })
      }}
      onRemove={() => {
        if (idea.boardId) {
          setDetachError(null)
          setDetaching({
            id: idea.id,
            title: idea.title,
            boardId: idea.boardId,
            boardName: boardName(idea.boardId),
          })
        }
      }}
    />
  )

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

  const actions = (idea: Idea) => {
    const offer = board ? null : offerDetach(idea, issues.has(idea.id))
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <RowActions
          itemLabel={idea.title}
          onView={(from) => view(idea.id, from)}
          onEdit={(from) => edit(idea.id, from)}
          onRemove={() => setRemoving({ id: idea.id, title: idea.title, boardId: idea.boardId })}
          canEdit={canEdit(idea)}
          canRemove={canDelete(idea)}
        />
        {offer ? detachButton(idea, offer) : null}
      </span>
    )
  }

  const boardName = (boardId: string | null) =>
    boardId === null ? 'No board' : (boardsById.get(boardId)?.name ?? board?.name ?? '')

  const columns: Column<Idea>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (idea) => (
        <>
          <div className="flex flex-col">
            <button
              type="button"
              onClick={(event) => view(idea.id, event.currentTarget)}
              className="text-left font-semibold hover:text-accent-foreground hover:underline truncate"
            >
              {idea.title}
            </button>
            <span className="text-xs text-muted-foreground font-normal">
              {boardName(idea.boardId)}
              {archived(idea.boardId) ? ' · Archived' : ''}
            </span>
          </div>
          {idea.effort ? <EffortBar effort={idea.effort} className="mt-1 flex w-fit" /> : null}
        </>
      ),
    },
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
      cell: (idea) => (idea.priority ? <PriorityMarker priority={idea.priority} /> : null),
    },
    {
      key: 'assignedTo',
      header: 'Assignees',
      cell: (idea) => <People people={idea.assignees} />,
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (idea) => <TagList tags={idea.tags} max={2} />,
      className: 'hidden min-[1100px]:table-cell',
    },
    { key: 'upvoteCount', header: 'Votes', numeric: true, cell: (idea) => idea.upvotes },
  ]

  // The idea read does not carry Effort (`contracts/ideas.md`), the list rows do: take it from the
  // row, which is on this page whenever the drawer was opened from it.
  const drawerIdea = drawer.idea
    ? { ...drawer.idea, effort: rows.find((row) => row.id === drawer.idea?.id)?.effort ?? null }
    : null
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
            options={[
              // `none` is the API's own spelling of the ideas that belong to no board.
              { value: 'none', label: 'No board' },
              ...boards.map((b) => ({
                value: b.id,
                label: b.isArchived ? `${b.name} (archived)` : b.name,
              })),
            ]}
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
        {board
          ? null
          : (
              [
                ['scope', SCOPES],
                ['phase', PHASES],
              ] as const
            ).map(([key, labels]) => {
              const value = state.filters[key]?.[0]
              const label =
                value !== undefined && Object.hasOwn(labels, value)
                  ? labels[value as keyof typeof labels]
                  : null
              return label ? (
                <Button
                  key={key}
                  variant="secondary"
                  size="sm"
                  aria-label={`Remove filter: ${label}`}
                  onClick={() => update({ filters: { ...state.filters, [key]: [] } })}
                >
                  {label}
                  <Icon name="x" />
                </Button>
              ) : null
            })}
      </ListToolbar>

      {removeError ? (
        <Alert variant="destructive" role="alert">
          <span>{removeError}</span>
        </Alert>
      ) : null}
      {detachError ? (
        <Alert variant="destructive" role="alert">
          <span>{detachError}</span>
        </Alert>
      ) : null}

      {state.view === 'lanes' && board ? (
        <>
          {board.canReorder ? (
            <p role="status" className="sr-only">
              {reorderNews}
            </p>
          ) : null}
          {board.canMove ? (
            <p aria-live="polite" className="sr-only">
              {cardNews}
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
          {moveError ? (
            <Alert variant="destructive" role="alert">
              <span>{moveError}</span>
            </Alert>
          ) : null}
          {effortFix ? (
            <Alert variant="destructive" role="alert">
              <span>
                Can’t move {effortFix.title}. Add Effort to ‘{effortFix.title}’ before moving it to{' '}
                {effortFix.laneName}.
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => openDrawer({ edit: effortFix.ideaId })}>
                  Add effort
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEffortFix(null)}>
                  Dismiss
                </Button>
              </span>
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
                ideas={laneRows.filter((idea) => idea.statusId === status.id)}
                previousStatusId={lanes[index - 1]?.id ?? null}
                nextStatusId={lanes[index + 1]?.id ?? null}
                canMove={board.canMove}
                upvoteDenial={engagement}
                selectedId={selectedId}
                onOpen={view}
                onKeyMove={board.canMove ? keyMoveCard : undefined}
                referenceLabel={
                  status.referencesBoardId
                    ? (board.referenceBoards?.[status.referencesBoardId]?.label ?? null)
                    : null
                }
                cardWork={(idea) => workFor(idea, index)}
                cardDrag={
                  board.canMove
                    ? ({
                        active: draggingCard !== null,
                        draggingId: draggingCard?.id ?? null,
                        over: draggingCard !== null && overCardLane === status.id,
                        refusal: (() => {
                          const dragged = draggingCard
                            ? laneRows.find((row) => row.id === draggingCard.id)
                            : undefined
                          return dragged ? moveRefusal(dragged, lanes, status.id) : null
                        })(),
                        onDragStart: (ideaId) => {
                          const idea = laneRows.find((row) => row.id === ideaId)
                          if (idea) setDraggingCard({ id: ideaId, statusId: idea.statusId })
                        },
                        onDragEnd: () => {
                          setDraggingCard(null)
                          setOverCardLane(null)
                        },
                        // A drop on the card's own lane does nothing, so it is not offered; nor is
                        // one a rule would refuse (the lane says why while the drag is under way).
                        onDragOver: () => {
                          if (draggingCard === null || draggingCard.statusId === status.id) {
                            return false
                          }
                          const dragged = laneRows.find((row) => row.id === draggingCard.id)
                          if (dragged && moveRefusal(dragged, lanes, status.id)) return false
                          setOverCardLane(status.id)
                          return true
                        },
                        onDragLeave: () =>
                          setOverCardLane((current) => (current === status.id ? null : current)),
                        onDrop: () => {
                          const dragged = draggingCard
                          setDraggingCard(null)
                          setOverCardLane(null)
                          const idea = dragged
                            ? laneRows.find((row) => row.id === dragged.id)
                            : null
                          if (
                            dragged &&
                            dragged.statusId !== status.id &&
                            !(idea && moveRefusal(idea, lanes, status.id))
                          ) {
                            moveCard(dragged.id, board.id, status)
                          }
                        },
                      } satisfies CardDrag)
                    : null
                }
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
                      {idea.priority ? <PriorityMarker priority={idea.priority} /> : null}
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
            <>
              {rows.length > 1 ? (
                <QuickAddBar
                  fields={[
                    {
                      name: 'title',
                      label: 'Title',
                      required: true,
                      placeholder: 'Add an idea — press Enter for more fields',
                      maxLength: TITLE_MAX_LENGTH,
                    },
                  ]}
                  canAdd={canAdd}
                  label="Quick add idea"
                  handoff="drawer"
                  onHandoff={handoff}
                  testId="ideas-quick-add-bar"
                />
              ) : null}
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
            </>
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
        boardName={
          drawerIdea
            ? boardName(drawerIdea.boardId)
            : drawerBoardId
              ? boardName(drawerBoardId)
              : null
        }
        boardLine={
          drawerIdea && drawer.mode !== 'create'
            ? {
                name: drawerIdea.boardId === null ? null : boardName(drawerIdea.boardId),
                archived: archived(drawerIdea.boardId),
                action: (() => {
                  const offer = offerDetach(drawerIdea, drawer.isIssue === true)
                  return offer ? detachButton(drawerIdea, offer) : null
                })(),
              }
            : null
        }
        statusColor={drawerIdea ? statusById.get(drawerIdea.statusId)?.color : undefined}
        formOptions={drawer.formOptions}
        assistAvailable={drawer.assistAvailable === true}
        tasks={drawer.tasks}
        blockers={drawer.blockers}
        referenceLane={
          drawerIdea?.boardId
            ? (boardsById.get(drawerIdea.boardId)?.hasReferenceLane ?? false)
            : false
        }
        effortNeeded={
          effortFix && drawerIdea?.id === effortFix.ideaId
            ? `Add Effort to move this idea to ${effortFix.laneName}.`
            : undefined
        }
        createBoards={boards}
        createBoardId={board?.id ?? null}
        initial={prefill ?? undefined}
        canEdit={drawerIdea ? canEdit(drawerIdea) : false}
        canDelete={drawerIdea ? canDelete(drawerIdea) : false}
        contentLocked={
          drawerIdea ? !mayEditIdeaContent(user.role, user.userId, drawerIdea.authorUserId) : false
        }
        engagementDenial={engagement}
        followDenial={followDenial(user.role)}
        returnFocusTo={trigger}
        onEdit={() => drawerIdea && openDrawer({ edit: drawerIdea.id })}
        onView={() => drawerIdea && openDrawer({ view: drawerIdea.id })}
        onClose={() => {
          quickAdded.current = false
          openDrawer(null)
          setTrigger(null)
        }}
        onDelete={() =>
          drawerIdea &&
          setRemoving({ id: drawerIdea.id, title: drawerIdea.title, boardId: drawerIdea.boardId })
        }
        onSaved={(ideaId) => {
          // Only an idea added through the quick-add row is scrolled to and highlighted.
          if (quickAdded.current) highlight(ideaId)
          quickAdded.current = false
          setEffortFix(null)
          openDrawer({ view: ideaId })
        }}
      />

      <MoveAnywayDialog
        open={forcing !== null}
        title={
          forcing?.kind === 'remove'
            ? 'Remove from board anyway?'
            : `Move past ${forcing?.openTasks ?? 0} open ${forcing?.openTasks === 1 ? 'task' : 'tasks'}?`
        }
        body={forcingBody(forcing)}
        confirmLabel={forcing?.kind === 'remove' ? 'Remove anyway' : 'Move anyway'}
        lanes={
          forcing?.kind === 'move'
            ? lanes.filter(
                (lane) => lane.id !== laneRows.find((r) => r.id === forcing.idea.id)?.statusId,
              )
            : undefined
        }
        defaultLaneId={forcing?.kind === 'move' ? forcing.toLane.id : undefined}
        pending={forcePending}
        onConfirm={confirmForce}
        onCancel={() => setForcing(null)}
      />

      <ConfirmDialog
        open={detaching !== null}
        title={`Remove “${detaching?.title ?? ''}” from ${detaching?.boardName ?? 'its board'}?`}
        description="It moves to the Ideas list with no board and keeps its status, comments, upvotes and followers. No one is notified. Anyone who can pull it can put it on a board later."
        confirmLabel="Remove from board"
        pending={detachPending}
        onConfirm={confirmDetach}
        onCancel={() => setDetaching(null)}
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
