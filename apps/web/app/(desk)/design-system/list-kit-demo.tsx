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
  QuickAddRow,
  RowActions,
  type Sort,
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

        <QuickAddDemo />
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

type DemoIssue = { id: string; title: string; effort: string; sprint: string }

const DEMO_EFFORTS = ['Low', 'Medium', 'High'].map((value) => ({ value, label: value }))
const DEMO_SPRINTS = [
  { value: '', label: 'Backlog' },
  { value: 'Sprint 14', label: 'Sprint 14' },
]
const DEMO_COLUMNS: Column<DemoIssue>[] = [
  { key: 'title', header: 'Title', cell: (issue) => issue.title },
  { key: 'effort', header: 'Effort', cell: (issue) => issue.effort },
  { key: 'sprint', header: 'Sprint', cell: (issue) => issue.sprint || 'Backlog' },
]

/**
 * The quick-add row on a small local table, in both hand-off modes. Nothing is saved: "create"
 * adds to local state after a short delay (a title containing "fail" is refused, to show the error
 * state), and "drawer" opens a stand-in drawer showing the values it would pre-populate. Widen the
 * window to md or more to see the row; below that it is hidden and the header button is the path.
 */
function QuickAddDemo() {
  const [mode, setMode] = useState<'drawer' | 'create'>('drawer')
  const [canAdd, setCanAdd] = useState(true)
  const [sort, setSort] = useState<Sort | null>({ key: 'title', dir: 'asc' })
  const [issues, setIssues] = useState<DemoIssue[]>([
    { id: 'd1', title: 'Archive exports', effort: 'Medium', sprint: '' },
    { id: 'd2', title: 'Bulk edit tags', effort: 'High', sprint: 'Sprint 14' },
    { id: 'd3', title: 'Quieter digests', effort: 'Low', sprint: '' },
  ])
  const [handoff, setHandoff] = useState<Record<string, string> | null>(null)
  const sorted = sortRows(issues, sort, (issue, key) => issue[key as keyof DemoIssue] as string)

  return (
    <section aria-labelledby="quick-add-demo" className="flex flex-col gap-3 border-t pt-4">
      <h3 id="quick-add-demo" className="m-0 text-base">
        Quick-add row
      </h3>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="m-0 flex items-center gap-2 font-normal">
          <input
            type="checkbox"
            checked={mode === 'create'}
            onChange={(event) => setMode(event.target.checked ? 'create' : 'drawer')}
          />
          Create directly (unticked, Enter hands off to a drawer)
        </label>
        <label className="m-0 flex items-center gap-2 font-normal">
          <input
            type="checkbox"
            checked={canAdd}
            onChange={(event) => setCanAdd(event.target.checked)}
          />
          This role may add (unticked is Read Only: the row is hidden)
        </label>
      </div>
      <DataTable
        caption="Quick-add demo"
        columns={DEMO_COLUMNS}
        rows={sorted}
        rowKey={(issue) => issue.id}
        sort={sort}
        onSortChange={setSort}
        quickAdd={(layout) => {
          const fields = [
            {
              name: 'title',
              label: 'Title',
              required: true,
              placeholder: 'Add an issue, then press Enter',
              maxLength: 120,
            },
            {
              name: 'effort',
              label: 'Effort',
              column: 'effort',
              required: true,
              options: DEMO_EFFORTS,
              placeholder: 'Choose effort',
            },
            {
              name: 'sprint',
              label: 'Sprint',
              column: 'sprint',
              options: DEMO_SPRINTS,
              defaultValue: '',
            },
          ]
          const common = {
            layout,
            fields,
            canAdd,
            label: 'Quick add issue',
            rowIds: issues.map((issue) => issue.id).join(','),
            testId: 'quick-add-demo',
          }
          return mode === 'drawer' ? (
            <QuickAddRow {...common} handoff="drawer" onHandoff={setHandoff} />
          ) : (
            <QuickAddRow
              {...common}
              handoff="create"
              onHandoff={setHandoff}
              onSubmit={async (values) => {
                await new Promise((resolve) => setTimeout(resolve, 600))
                if (/fail/i.test(values.title ?? '')) {
                  return {
                    ok: false,
                    error: null,
                    errors: { title: 'That title was refused (demo).' },
                  }
                }
                const id = `d${Date.now()}`
                setIssues((list) => [
                  ...list,
                  {
                    id,
                    title: values.title ?? '',
                    effort: values.effort ?? '',
                    sprint: values.sprint ?? '',
                  },
                ])
                return {
                  ok: true,
                  id,
                  message: values.sprint ? `Issue added to ${values.sprint}` : 'Issue added',
                }
              }}
            />
          )
        }}
      />
      <Drawer
        open={handoff !== null}
        onClose={() => setHandoff(null)}
        eyebrow="New issue"
        title="Add New Issue"
        footer={
          <Button variant="outline" onClick={() => setHandoff(null)}>
            Close
          </Button>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          The drawer opens pre-populated with the row&rsquo;s values (nothing is created until its
          form is saved):
        </p>
        <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-sm">
          {Object.entries(handoff ?? {}).map(([name, value]) => (
            <div key={name}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{name}</dt>
              <dd className="m-0 mt-0.5 font-medium">{value || 'Backlog / empty'}</dd>
            </div>
          ))}
        </dl>
      </Drawer>
    </section>
  )
}
