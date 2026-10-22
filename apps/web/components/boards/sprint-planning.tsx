'use client'

import { Button, Input } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ParentChip } from '@/components/ideas/idea-badges'
import { ConfirmDialog } from '@/components/list'
import { blockedBadge, blockedTooltip, isBlockedHere, type WorkLane } from '@/lib/board-work'
import {
  addSprintTask,
  moveTasksToSprint,
  startBoardSprint,
} from '@/lib/server/sprint-planning-actions'
import type { Idea, Sprint } from '@/lib/types'
import { SprintStateChip } from './sprint-state-chip'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The sprint planning page (comp W screen 4): the Backlog on the left, "In this sprint" on the
 * right. Add and Remove are buttons, so the page works by keyboard and touch. Remove sends a `null`
 * sprint, which returns the task to the Backlog. A Completed sprint is a record and takes no
 * changes; `canPlan` (admin only, TB-10) switches every control on or off. Counts are the page's
 * fresh read after each write, so they move without a reload.
 */
export function SprintPlanning({
  boardId,
  organizationId,
  sprint,
  backlog,
  backlogTotal,
  inSprint,
  lanes,
  canPlan,
}: {
  boardId: string
  organizationId: string | null
  sprint: Sprint
  backlog: readonly Idea[]
  backlogTotal: number
  inSprint: readonly Idea[]
  lanes: readonly WorkLane[]
  canPlan: boolean
}) {
  const editable = canPlan && sprint.state !== 'Completed'
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const noticeRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term
      ? backlog.filter((row) =>
          [row.title, row.itemKey ?? '', row.parentItemKey ?? ''].some((text) =>
            text.toLowerCase().includes(term),
          ),
        )
      : backlog
  }, [backlog, query])

  function move(row: Idea, to: string | null) {
    setError(null)
    start(async () => {
      const result = await moveTasksToSprint(boardId, to, [row.id])
      if (result.error) setError(result.error)
      else
        setNotice(
          to
            ? `Added ${row.itemKey ?? row.title} to ${sprint.name}.`
            : `${row.itemKey ?? row.title} is back in the Backlog.`,
        )
    })
  }

  function addNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    start(async () => {
      const result = await addSprintTask(boardId, sprint.id, text)
      if (result.error) setError(result.error)
      else {
        setTitle('')
        setNotice(`Added “${text}” to ${sprint.name}.`)
      }
    })
  }

  function startSprint() {
    if (!organizationId) return
    start(async () => {
      const result = await startBoardSprint(boardId, organizationId, sprint.id)
      setConfirming(false)
      if (result.error) setError(result.error)
      else setNotice(`${sprint.name} started.`)
    })
  }

  const row = (item: Idea, side: 'backlog' | 'sprint') => (
    <li key={item.id} className="flex items-start gap-2 border-b p-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-mono">{item.itemKey ?? '—'}</span>
          {item.parentIdeaId ? (
            <ParentChip itemKey={item.parentItemKey ?? null} />
          ) : (
            <span className="rounded border px-1.5 text-muted-foreground">standalone</span>
          )}
          {isBlockedHere(item, lanes) ? (
            <span
              title={blockedTooltip(item)}
              className="rounded-sm bg-warning/12 px-1.5 font-semibold text-warning"
            >
              {blockedBadge(item)}
            </span>
          ) : null}
        </span>
        <Link
          href={
            `/boards/${encodeURIComponent(boardId)}?tab=board&idea=${encodeURIComponent(item.id)}` as Route
          }
          className="text-sm font-medium text-foreground hover:underline"
        >
          {item.title}
        </Link>
        {side === 'sprint' ? (
          <span className="text-xs text-muted-foreground">{item.statusName}</span>
        ) : null}
      </div>
      {editable ? (
        side === 'backlog' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`Add ${item.itemKey ?? item.title} to ${sprint.name}`}
            onClick={() => move(item, sprint.id)}
          >
            Add →
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label={`Remove ${item.itemKey ?? item.title} from ${sprint.name}`}
            onClick={() => move(item, null)}
          >
            × Remove
          </Button>
        )
      ) : null}
    </li>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <SprintStateChip state={sprint.state} />
        <span className="tabular-nums">
          {sprint.startDate} → {sprint.endDate}
        </span>
        <span role="status" className="tabular-nums">
          <b className="font-semibold text-foreground">{inSprint.length}</b>{' '}
          {inSprint.length === 1 ? 'task' : 'tasks'} in this sprint
        </span>
        {canPlan && sprint.state === 'Planned' && organizationId ? (
          <Button
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Start sprint
          </Button>
        ) : null}
      </div>
      {sprint.goal ? <p className="m-0 text-sm">{sprint.goal}</p> : null}
      {sprint.state === 'Completed' ? (
        <p className="m-0 text-sm text-muted-foreground">
          This sprint is completed. It is a record of what shipped and takes no changes.
        </p>
      ) : null}
      {notice ? (
        <p
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          className="m-0 text-sm text-muted-foreground focus:outline-none"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <div className={editable ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
        {editable ? (
          <section aria-label="Backlog" className="min-w-0 rounded-lg border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b p-2.5">
              <h2 className="m-0 text-sm font-semibold">Backlog</h2>
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {backlogTotal} unassigned
              </span>
              <Input
                aria-label="Search the Backlog"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="ml-auto h-8 w-36"
              />
            </header>
            {shown.length === 0 ? (
              <p className="m-0 p-4 text-center text-sm text-muted-foreground">
                {backlog.length === 0 ? 'Nothing waiting in the Backlog.' : 'No task matches.'}
              </p>
            ) : (
              <ul aria-label="Backlog tasks" className="m-0 list-none p-0">
                {shown.map((item) => row(item, 'backlog'))}
              </ul>
            )}
          </section>
        ) : null}

        <section aria-label="In this sprint" className="min-w-0 rounded-lg border bg-card">
          <header className="flex items-center gap-2 border-b p-2.5">
            <h2 className="m-0 text-sm font-semibold">In this sprint</h2>
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {plural(inSprint.length, 'task')}
            </span>
          </header>
          {editable ? (
            <form onSubmit={addNew} className="flex gap-2 border-b p-2.5">
              <Input
                aria-label="New task title"
                placeholder="New task in this sprint…"
                value={title}
                maxLength={150}
                autoComplete="off"
                onChange={(event) => setTitle(event.target.value)}
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending || !title.trim()}>
                Add task
              </Button>
            </form>
          ) : null}
          {inSprint.length === 0 ? (
            <p className="m-0 p-4 text-center text-sm text-muted-foreground">
              No tasks in this sprint yet.
            </p>
          ) : (
            <ul aria-label="Sprint tasks" className="m-0 list-none p-0">
              {inSprint.map((item) => row(item, 'sprint'))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Start this sprint?"
        description={`“${sprint.name}” becomes the running sprint with ${plural(inSprint.length, 'task')}.`}
        confirmLabel="Start sprint"
        destructive={false}
        pending={pending}
        onConfirm={startSprint}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
