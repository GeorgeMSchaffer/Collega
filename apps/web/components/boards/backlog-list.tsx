'use client'

import { Button, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ParentChip } from '@/components/ideas/idea-badges'
import { People, TagList } from '@/components/ideas/idea-chips'
import { ListToolbar, MultiSelectFilter } from '@/components/list'
import { blockedBadge, blockedTooltip, isBlockedHere, type WorkLane } from '@/lib/board-work'
import type { Idea } from '@/lib/types'

const STANDALONE = 'none'

/**
 * A work board's Backlog (comp W screens 1 and 5): the board's live tasks and standalone cards in no
 * sprint, as the API listed them. Search, parent, assignee and tag filter the rows that arrived (up
 * to the API's page maximum); the count says so when the board holds more than it was sent.
 *
 * `canSelect` is the sprint-planning role on a board with sprints on: the checkboxes exist for the
 * bulk bar a later slice adds, so a reader who could never use them does not get them.
 */
export function BacklogList({
  boardId,
  boardName,
  rows,
  total,
  lanes,
  canSelect,
  newTaskHref,
}: {
  boardId: string
  boardName: string
  rows: readonly Idea[]
  total: number
  lanes: readonly WorkLane[]
  canSelect: boolean
  /** The "+ New task" link, or `null` for a reader who may not add one. */
  newTaskHref: string | null
}) {
  const [query, setQuery] = useState('')
  const [parents, setParents] = useState<string[]>([])
  const [assignees, setAssignees] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const parentOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of rows) {
      if (row.parentIdeaId) seen.set(row.parentIdeaId, row.parentItemKey ?? 'Parent')
    }
    return [
      { value: STANDALONE, label: 'Standalone (no parent)' },
      ...[...seen].map(([value, label]) => ({ value, label })),
    ]
  }, [rows])
  const assigneeOptions = useMemo(
    () =>
      [
        ...new Map(rows.flatMap((row) => row.assignees).map((person) => [person.id, person.name])),
      ].map(([value, label]) => ({ value, label })),
    [rows],
  )
  const tagOptions = useMemo(
    () => [...new Set(rows.flatMap((row) => row.tags.map((tag) => tag.name)))].sort(),
    [rows],
  )

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (
        term &&
        ![row.title, row.itemKey ?? '', row.parentItemKey ?? '', row.statusName].some((text) =>
          text.toLowerCase().includes(term),
        )
      ) {
        return false
      }
      if (parents.length > 0 && !parents.includes(row.parentIdeaId ?? STANDALONE)) return false
      if (assignees.length > 0 && !row.assignees.some((person) => assignees.includes(person.id))) {
        return false
      }
      if (tags.length > 0 && !row.tags.some((tag) => tags.includes(tag.name))) return false
      return true
    })
  }, [rows, query, parents, assignees, tags])

  if (rows.length === 0) {
    return (
      <EmptyState
        heading="Nothing waiting for a sprint"
        action={
          newTaskHref ? (
            <Link href={newTaskHref as never} className="text-sm font-medium text-primary">
              + New task
            </Link>
          ) : undefined
        }
      >
        Every task on {boardName} is in a sprint or finished. Add a task here, or from an
        idea&rsquo;s drawer once the idea reaches this board.
      </EmptyState>
    )
  }

  const visibleSelected = shown.filter((row) => selected.has(row.id)).length
  const allShown = shown.length > 0 && visibleSelected === shown.length
  const filtered = shown.length !== rows.length

  function toggle(id: string) {
    const next = new Set(selected)
    if (!next.delete(id)) next.add(id)
    setSelected(next)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        label="Search tasks"
        placeholder="Search tasks by title, key, parent, status…"
        debounceMs={0}
      >
        <MultiSelectFilter
          label="Parent idea"
          options={parentOptions}
          selected={parents}
          onChange={setParents}
        />
        <MultiSelectFilter
          label="Assignee"
          options={assigneeOptions}
          selected={assignees}
          onChange={setAssignees}
        />
        <MultiSelectFilter label="Tag" options={tagOptions} selected={tags} onChange={setTags} />
      </ListToolbar>

      <div className="flex min-h-8 flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span role="status">
          {filtered ? `${shown.length} of ${rows.length} tasks` : `${rows.length} tasks`}
          {total > rows.length ? ` (first ${rows.length} of ${total}, newest first)` : null}
          {canSelect && selected.size > 0 ? ` · ${selected.size} selected` : null}
        </span>
        {canSelect && selected.size > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        ) : null}
        <span className="ml-auto">Sorted by: newest</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[720px]">
          <caption className="sr-only">Tasks on {boardName} waiting for a sprint</caption>
          <thead>
            <tr>
              {canSelect ? (
                <th scope="col" className="w-px px-3.5">
                  <input
                    type="checkbox"
                    aria-label="Select all shown tasks"
                    checked={allShown}
                    onChange={() => {
                      const next = new Set(selected)
                      for (const row of shown) {
                        if (allShown) next.delete(row.id)
                        else next.add(row.id)
                      }
                      setSelected(next)
                    }}
                  />
                </th>
              ) : null}
              <th scope="col" className="px-3.5">
                Key
              </th>
              <th scope="col" className="px-3.5">
                Task
              </th>
              <th scope="col" className="px-3.5">
                Parent idea
              </th>
              <th scope="col" className="px-3.5">
                Status
              </th>
              <th scope="col" className="px-3.5">
                Assignee
              </th>
              <th scope="col" className="hidden px-3.5 min-[1100px]:table-cell">
                Tags
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={canSelect ? 7 : 6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No task matches these filters.
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr key={row.id} data-row-key={row.id}>
                  {canSelect ? (
                    <td className="px-3.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.itemKey ?? row.title}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                  ) : null}
                  <td className="px-3.5 font-mono text-xs whitespace-nowrap">
                    {row.itemKey ?? '—'}
                  </td>
                  <td className="px-3.5">
                    <Link
                      href={
                        `/boards/${encodeURIComponent(boardId)}?tab=board&idea=${encodeURIComponent(row.id)}` as never
                      }
                      className="font-medium text-foreground hover:underline"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3.5">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {row.parentIdeaId ? (
                        <ParentChip itemKey={row.parentItemKey ?? null} />
                      ) : (
                        <span className="rounded border px-1.5 text-xs text-muted-foreground">
                          standalone
                        </span>
                      )}
                      {isBlockedHere(row, lanes) ? (
                        <span
                          title={blockedTooltip(row)}
                          className="rounded-sm bg-warning/12 px-1.5 text-xs font-semibold text-warning"
                        >
                          {blockedBadge(row)}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3.5 whitespace-nowrap">{row.statusName}</td>
                  <td className="px-3.5">
                    <People people={row.assignees} />
                  </td>
                  <td className="hidden px-3.5 min-[1100px]:table-cell">
                    <TagList tags={row.tags} max={2} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
