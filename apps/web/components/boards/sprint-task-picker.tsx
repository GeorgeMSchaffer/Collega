'use client'

import { Button, Input, Select } from '@collega/design-system'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ParentChip } from '@/components/ideas/idea-badges'
import { blockedBadge, blockedTooltip } from '@/lib/board-work'
import type { Idea } from '@/lib/types'

const ALL = ''
const STANDALONE = 'none'

/**
 * The create-sprint drawer's unassigned-task picker (TB-3, TB-4; comp W screen 3 frame A): the
 * board's Backlog rows with search and a parent filter. A blocked task can be picked, with its
 * blocker shown, because the blocker may be going into this sprint too. Which tasks are eligible is
 * the API's call (`sprintId=none`, this board); a task that slipped through is refused on create and
 * the refusal lands in `error`.
 */
export function SprintTaskPicker({
  tasks,
  selected,
  onChange,
  error,
}: {
  tasks: readonly Idea[]
  selected: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
  error: string | null
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [parent, setParent] = useState(ALL)
  const alert = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (error) alert.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  const parents = useMemo(() => {
    const seen = new Map<string, string>()
    for (const task of tasks) {
      if (task.parentIdeaId) seen.set(task.parentIdeaId, task.parentItemKey ?? 'Parent')
    }
    return [...seen]
  }, [tasks])

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase()
    return tasks.filter((task) => {
      if (parent === STANDALONE && task.parentIdeaId) return false
      if (parent !== ALL && parent !== STANDALONE && task.parentIdeaId !== parent) return false
      return (
        !term ||
        [task.title, task.itemKey ?? '', task.parentItemKey ?? ''].some((text) =>
          text.toLowerCase().includes(term),
        )
      )
    })
  }, [tasks, query, parent])

  const ideaCount = new Set(
    tasks.filter((task) => selected.has(task.id)).map((task) => task.parentIdeaId ?? task.id),
  ).size
  const parentTasks = parent !== ALL && parent !== STANDALONE
  const parentLabel = parents.find(([value]) => value === parent)?.[1]

  function toggle(taskId: string) {
    const next = new Set(selected)
    if (!next.delete(taskId)) next.add(taskId)
    onChange(next)
  }

  return (
    <section aria-labelledby={`${id}-h`} className="mt-1 rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <h3 id={`${id}-h`} className="m-0 mr-auto text-sm font-semibold">
          Tasks{' '}
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            Unassigned only
          </span>
        </h3>
        <Input
          aria-label="Search tasks"
          placeholder="Search"
          value={query}
          className="w-36"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="Parent idea"
          value={parent}
          className="w-44"
          onChange={(event) => setParent(event.target.value)}
        >
          <option value={ALL}>All parent ideas</option>
          <option value={STANDALONE}>Standalone (no parent)</option>
          {parents.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {tasks.length === 0 ? (
        <p className="m-0 px-3 py-4 text-sm text-muted-foreground">
          Every task on this board is in a sprint or finished. The sprint starts empty; add tasks
          later.
        </p>
      ) : (
        <ul className="m-0 max-h-72 list-none overflow-auto p-0">
          {shown.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">No task matches.</li>
          ) : (
            shown.map((task) => {
              const badge = blockedBadge(task)
              return (
                <li key={task.id} className="border-b last:border-b-0">
                  <label className="flex min-h-10 cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5 text-sm hover:bg-muted/50 has-[:focus-visible]:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() => toggle(task.id)}
                    />
                    <span className="font-mono text-xs whitespace-nowrap">
                      {task.itemKey ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1 basis-40">{task.title}</span>
                    {badge ? (
                      <span
                        title={blockedTooltip(task)}
                        className="rounded-sm bg-warning/12 px-1.5 text-xs font-semibold text-warning"
                      >
                        {badge}
                      </span>
                    ) : null}
                    {task.parentIdeaId ? (
                      <ParentChip itemKey={task.parentItemKey ?? null} />
                    ) : (
                      <span className="rounded border px-1.5 text-xs text-muted-foreground">
                        standalone
                      </span>
                    )}
                  </label>
                </li>
              )
            })
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 text-sm text-muted-foreground">
        <span role="status" className="flex flex-wrap gap-x-3">
          <span>
            <b className="text-foreground">{selected.size}</b> selected
          </span>
          {selected.size > 0 ? (
            <span>
              from {ideaCount} {ideaCount === 1 ? 'idea' : 'ideas'}
            </span>
          ) : null}
          <span>
            {shown.length === tasks.length
              ? `${tasks.length} unassigned`
              : `${shown.length} of ${tasks.length} unassigned`}
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={!parentTasks}
          title={parentTasks ? undefined : 'Choose a parent idea in the filter first.'}
          onClick={() => {
            const next = new Set(selected)
            for (const task of tasks) if (task.parentIdeaId === parent) next.add(task.id)
            onChange(next)
          }}
        >
          {parentLabel ? `Select all ${parentLabel} tasks` : 'Select all of this idea’s tasks'}
        </Button>
      </div>
      {error ? (
        <p
          ref={alert}
          role="alert"
          className="m-0 border-t px-3 py-2 text-xs font-semibold text-destructive"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}
