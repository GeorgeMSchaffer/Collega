'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@collega/design-system'
import { useState } from 'react'
import {
  type Column,
  ConfirmDialog,
  DataTable,
  Drawer,
  filterRows,
  type ListConfig,
  ListToolbar,
  MultiSelectFilter,
  Pager,
  pageRows,
  RowActions,
  sortRows,
  useListState,
  ViewSwitch,
} from '@/components/list'
import type { BoardOverview } from '@/lib/types'

const CONFIG: ListConfig = {
  filters: ['createdBy', 'tag'],
  views: ['list', 'cards'],
  sortKeys: ['name', 'ideaCount', 'laneCount', 'createdBy', 'createdOn'],
}

const COLUMNS: Column<BoardOverview>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (board) => (
      <>
        <span className="font-semibold">{board.name}</span>
        {board.description ? (
          <span className="block max-w-[52ch] truncate text-xs text-muted-foreground">
            {board.description}
          </span>
        ) : null}
      </>
    ),
  },
  { key: 'ideaCount', header: 'Ideas', numeric: true, cell: (board) => board.ideaCount },
  { key: 'laneCount', header: 'Lanes', numeric: true, cell: (board) => board.laneCount },
  { key: 'createdBy', header: 'Created by', cell: (board) => board.createdBy ?? '—' },
  { key: 'createdOn', header: 'Created', numeric: true, cell: (board) => board.createdOn },
]

type Open = { mode: 'view' | 'edit'; board: BoardOverview; trigger: HTMLElement }

/**
 * The list kit wired to this organization's boards, in the client, the way slice 101 will wire the
 * Boards screen. Nothing here writes: Archive asks, and confirming only closes the dialog.
 */
export function ListKitDemo({ boards }: { boards: BoardOverview[] }) {
  const [state, update] = useListState(CONFIG)
  const [open, setOpen] = useState<Open | null>(null)
  const [confirming, setConfirming] = useState<BoardOverview | null>(null)
  const [permitted, setPermitted] = useState(true)

  const creators = [...new Set(boards.map((b) => b.createdBy ?? '—'))].sort()
  const tags = [...new Set(boards.flatMap((b) => b.topTags.map((t) => t.name)))].sort()

  const filtered = filterRows(
    boards,
    state,
    (b) => [b.name, b.description, b.createdBy, ...b.topTags.map((t) => t.name)].join(' '),
    (b, key) => (key === 'tag' ? b.topTags.map((t) => t.name) : (b.createdBy ?? '—')),
  )
  const sorted = sortRows(
    filtered,
    state.sort,
    (b, key) => b[key as keyof BoardOverview] as string | number,
  )
  const page = pageRows(sorted, state.page, state.size)

  const actions = (board: BoardOverview) => (
    <RowActions
      itemLabel={board.name}
      onView={(trigger) => setOpen({ mode: 'view', board, trigger })}
      onEdit={(trigger) => setOpen({ mode: 'edit', board, trigger })}
      onRemove={() => setConfirming(board)}
      removeKind="archive"
      canEdit={permitted}
      canRemove={permitted}
    />
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>List and detail kit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="m-0 flex items-center gap-2 font-normal">
          <input
            type="checkbox"
            checked={permitted}
            onChange={(event) => setPermitted(event.target.checked)}
          />
          This role may edit and archive (unticked, Edit and Archive disappear from every row)
        </label>

        <ListToolbar
          query={state.q}
          onQueryChange={(q) => update({ q })}
          placeholder="Filter by name, description, tag, person…"
          end={
            <ViewSwitch
              views={CONFIG.views ?? []}
              value={state.view}
              onChange={(view) => update({ view, page: state.page })}
            />
          }
        >
          <MultiSelectFilter
            label="Created by"
            options={creators}
            selected={state.filters.createdBy ?? []}
            onChange={(createdBy) => update({ filters: { ...state.filters, createdBy } })}
          />
          <MultiSelectFilter
            label="Tags"
            options={tags}
            selected={state.filters.tag ?? []}
            onChange={(tag) => update({ filters: { ...state.filters, tag } })}
          />
        </ListToolbar>

        {state.view === 'list' ? (
          <DataTable
            caption="Boards"
            columns={COLUMNS}
            rows={page.rows}
            rowKey={(b) => b.id}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            actions={actions}
            selectedKey={open?.board.id ?? null}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5">
            {page.rows.map((board) => (
              <article key={board.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                <h3 className="m-0 text-base">{board.name}</h3>
                <p className="m-0 text-sm text-muted-foreground">{board.description}</p>
                <div className="mt-auto flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span>{board.ideaCount} ideas</span>
                  {actions(board)}
                </div>
              </article>
            ))}
            {page.rows.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Nothing matches these filters.</p>
            ) : null}
          </div>
        )}

        <Pager
          page={page.page}
          size={state.size}
          total={sorted.length}
          onPageChange={(n) => update({ page: n })}
          onSizeChange={(size) => update({ size })}
        />
      </CardContent>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        eyebrow={open ? `Boards · ${open.mode === 'edit' ? 'Edit' : 'View'}` : null}
        title={open?.board.name ?? ''}
        returnFocusTo={open?.trigger ?? null}
        footer={
          open?.mode === 'edit' ? (
            <>
              <span className="flex-1" />
              <Button variant="outline" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(null)}>Save</Button>
            </>
          ) : open && permitted ? (
            <>
              <Button variant="outline" onClick={() => setOpen({ ...open, mode: 'edit' })}>
                Edit
              </Button>
              <span className="flex-1" />
              <Button variant="outline" onClick={() => setConfirming(open.board)}>
                Archive
              </Button>
            </>
          ) : null
        }
      >
        {open ? (
          <>
            <p className="m-0 text-sm">{open.board.description ?? 'No description.'}</p>
            <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ideas</dt>
                <dd className="m-0 mt-0.5 font-medium">{open.board.ideaCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Lanes</dt>
                <dd className="m-0 mt-0.5 font-medium">{open.board.laneCount}</dd>
              </div>
            </dl>
            {open.mode === 'edit' ? (
              <p className="m-0 text-sm text-muted-foreground">
                The board form arrives with slice 101; this drawer shows the edit mode&rsquo;s
                frame.
              </p>
            ) : null}
          </>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirming !== null}
        title="Archive this board?"
        description={`“${confirming?.name ?? ''}” leaves the Boards list. Its ideas stay in Ideas, and you can unarchive it any time. (Nothing is archived from this gallery.)`}
        confirmLabel="Archive board"
        destructive={false}
        onConfirm={() => setConfirming(null)}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  )
}
