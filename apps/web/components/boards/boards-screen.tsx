'use client'

import { Alert, Button, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import {
  type Column,
  ConfirmDialog,
  DataTable,
  filterRows,
  type ListConfig,
  ListToolbar,
  MultiSelectFilter,
  Pager,
  pageRows,
  RowActions,
  type Sort,
  sortRows,
  useListState,
  ViewSwitch,
} from '@/components/list'
import { setBoardArchived } from '@/lib/server/board-actions'
import type { BoardOverview } from '@/lib/types'
import { BoardCard } from './board-card'
import { BoardDrawer, type BoardFormData, type DrawerMode } from './board-drawer'
import { BoardStatus, LaneFigures, LaneStrip, statusLabel, TopTags } from './board-parts'

const CONFIG: ListConfig = {
  filters: ['status'],
  filterDefaults: { status: ['Active'] },
  views: ['list', 'cards'],
  sortKeys: ['name', 'ideas', 'tags', 'created', 'status'],
}

const DEFAULT_SORT: Sort = { key: 'name', dir: 'asc' }

const STATUS_OPTIONS = ['Active', 'Archived']

const COLUMNS: Column<BoardOverview>[] = [
  {
    key: 'name',
    header: 'Board',
    className: 'max-w-0 w-[34%]',
    cell: (board) => (
      <>
        <Link href={`/boards/${board.id}`} className="font-semibold">
          {board.name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {board.description ?? <span className="italic">No description yet.</span>}
        </span>
      </>
    ),
  },
  {
    key: 'ideas',
    header: 'Ideas by lane',
    className: 'w-[26%]',
    cell: (board) => (
      <div className="flex flex-col gap-1.5">
        <LaneStrip board={board} />
        <LaneFigures board={board} />
      </div>
    ),
  },
  { key: 'tags', header: 'Top tags', cell: (board) => <TopTags board={board} limit={2} /> },
  {
    key: 'created',
    header: 'Created',
    className: 'text-xs leading-snug text-muted-foreground',
    cell: (board) => (
      <>
        {board.createdOn}
        {board.createdBy ? <span className="block">{board.createdBy}</span> : null}
      </>
    ),
  },
  { key: 'status', header: 'Status', cell: (board) => <BoardStatus board={board} /> },
]

/** What the text filter matches: every column the list shows, as a reader would read it. */
function textOf(board: BoardOverview): string {
  return [
    board.name,
    board.description ?? 'No description yet',
    ...board.lanes.map((lane) => lane.name),
    ...board.topTags.map((tag) => tag.name),
    board.createdOn,
    board.createdBy,
    statusLabel(board),
  ].join(' ')
}

function sortValue(board: BoardOverview, key: string): string | number {
  if (key === 'ideas') return board.ideaCount
  if (key === 'tags') return board.topTags[0]?.name ?? ''
  if (key === 'created') return board.createdAtUtc
  if (key === 'status') return statusLabel(board)
  return board.name
}

/**
 * The Boards screen on comp R's list and detail pattern (`SPEC/20-feature-client-ui.md`,
 * "`/boards` — Boards"): List or Cards, the Active / Archived filter, sorting and paging in the
 * client, row actions, and a drawer for view, edit and create.
 *
 * The drawer lives in the URL beside the list state — `?board={id}` to view, `&mode=edit` to edit,
 * `?board=new` to create — so a link opens what it names and Back closes it. The page reads the
 * same parameters to load the form's statuses when a form is open (`form`).
 *
 * Every permission here is a display decision from `adminDenial` (edit, archive) and
 * `createDenial` (Add New Board); the API refuses on its own.
 */
export function BoardsScreen({
  boards,
  adminDenial,
  createDenial,
  form,
}: {
  /** Every board, archived ones included: the Status filter is applied here. */
  boards: BoardOverview[]
  /** Why this role may not create, edit or archive boards, or null when it may. */
  adminDenial: string | null
  /** Why this role may not create a board, or null when it may — a User may, unlike editing. */
  createDenial: string | null
  /** The open form's seed values, loaded by the page; null when no form is open. */
  form: BoardFormData | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [state, update] = useListState(CONFIG)
  const [confirming, setConfirming] = useState<BoardOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [archiving, startArchive] = useTransition()
  const trigger = useRef<HTMLElement | null>(null)
  const isAdmin = adminDenial === null

  const requested = params.get('board')
  const open: { mode: DrawerMode; board: BoardOverview | null } | null = (() => {
    if (requested === 'new')
      return createDenial === null && form ? { mode: 'create', board: null } : null
    const board = boards.find((candidate) => candidate.id === requested)
    if (!board) return null
    // An archived board's settings are frozen (rule 13), so its edit link reads as its view.
    const editing =
      params.get('mode') === 'edit' && isAdmin && !board.isArchived && form?.boardId === board.id
    return { mode: editing ? 'edit' : 'view', board }
  })()

  function navigate(board: string | null, mode: 'edit' | null, from?: HTMLElement) {
    if (from) trigger.current = from
    const next = new URLSearchParams(params)
    next.delete('board')
    next.delete('mode')
    if (board) next.set('board', board)
    if (mode) next.set('mode', mode)
    const query = next.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
  }

  // A new question, or the answer "never mind", retires the last one's refusal.
  function ask(board: BoardOverview | null) {
    setError(null)
    setConfirming(board)
  }

  function confirmArchive() {
    const board = confirming
    if (!board) return
    startArchive(async () => {
      const result = await setBoardArchived(board.id, !board.isArchived)
      setError(result.error)
      setConfirming(null)
    })
  }

  const filtered = filterRows(boards, state, textOf, (board) => statusLabel(board))
  // Unsorted still means an order: by name, as comp R lists them, so a new board lands predictably.
  const sorted = sortRows(filtered, state.sort ?? DEFAULT_SORT, sortValue)
  const page = pageRows(sorted, state.page, state.size)

  const actions = (board: BoardOverview) => (
    <RowActions
      itemLabel={board.name}
      onView={(from) => navigate(board.id, null, from)}
      onEdit={(from) => navigate(board.id, 'edit', from)}
      onRemove={() => ask(board)}
      removeKind={board.isArchived ? 'unarchive' : 'archive'}
      canEdit={isAdmin && !board.isArchived}
      canRemove={isAdmin}
    />
  )

  const addNew = (
    <GatedAction id="why-new-board" label="Add New Board" denial={createDenial}>
      <Button onClick={(event) => navigate('new', null, event.currentTarget)}>Add New Board</Button>
    </GatedAction>
  )

  return (
    <>
      <PageHeader
        title="Boards"
        description={
          <>
            Every board organizes the same organization&rsquo;s ideas by status. Open one to see its
            lanes.
          </>
        }
        action={addNew}
      />

      {error ? (
        <Alert variant="destructive">
          <span>{error}</span>
        </Alert>
      ) : null}

      {boards.length === 0 ? (
        <EmptyState heading="No boards yet">
          A new organization starts with one default board and five statuses. Org Admins and Users
          add more with Add New Board.
        </EmptyState>
      ) : (
        <>
          <ListToolbar
            query={state.q}
            onQueryChange={(q) => update({ q })}
            placeholder="Filter by board, lane, tag, person, status…"
            end={
              <ViewSwitch
                views={CONFIG.views ?? []}
                value={state.view}
                onChange={(view) => update({ view, page: state.page })}
              />
            }
          >
            <MultiSelectFilter
              label="Status"
              options={STATUS_OPTIONS}
              selected={state.filters.status ?? []}
              onChange={(status) => update({ filters: { ...state.filters, status } })}
            />
          </ListToolbar>

          {state.view === 'list' ? (
            <DataTable
              caption="Boards"
              columns={COLUMNS}
              rows={page.rows}
              rowKey={(board) => board.id}
              sort={state.sort}
              onSortChange={(sort) => update({ sort })}
              actions={actions}
              selectedKey={open?.board?.id ?? null}
            />
          ) : page.rows.length === 0 ? (
            <p className="m-0 rounded-lg border bg-card py-6 text-center text-sm text-muted-foreground">
              Nothing matches these filters.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
              {page.rows.map((board) => (
                <BoardCard key={board.id} board={board} actions={actions(board)} />
              ))}
            </div>
          )}

          <Pager
            page={page.page}
            size={state.size}
            total={sorted.length}
            onPageChange={(n) => update({ page: n })}
            onSizeChange={(size) => update({ size })}
          />
        </>
      )}

      <BoardDrawer
        open={open}
        form={form}
        isAdmin={isAdmin}
        returnFocusTo={trigger.current}
        onClose={() => navigate(null, null)}
        onView={(boardId) => navigate(boardId, null)}
        onEdit={(boardId) => navigate(boardId, 'edit')}
        onArchive={ask}
      />

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.isArchived ? 'Unarchive this board?' : 'Archive this board?'}
        description={
          confirming?.isArchived
            ? `“${confirming.name}” returns to the Boards list and to the board picker.`
            : `“${confirming?.name ?? ''}” leaves the Boards list. Its ${confirming?.ideaCount ?? 0} ideas stay in Ideas, and you can unarchive it any time.`
        }
        confirmLabel={confirming?.isArchived ? 'Unarchive' : 'Archive board'}
        destructive={false}
        pending={archiving}
        onConfirm={confirmArchive}
        onCancel={() => ask(null)}
      />
    </>
  )
}
