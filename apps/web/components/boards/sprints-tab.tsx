'use client'

import { Button, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Idea, MemberOption, Sprint } from '@/lib/types'
import { SprintCreateDrawer } from './sprint-create-drawer'
import { SprintStateChip } from './sprint-state-chip'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * A work board's Sprints tab (comp W): each sprint with its window and task count, linking to its
 * planning page, and "N tasks waiting" for the Backlog it draws from. "+ New sprint" (admin only)
 * opens the create drawer over the waiting tasks. Counts come from the page's fresh read, so an add,
 * remove or create elsewhere shows here on the next render with no reload.
 */
export function SprintsTab({
  boardId,
  boardName,
  sprints,
  waiting,
  backlog,
  members,
  canPlan,
}: {
  boardId: string
  boardName: string
  sprints: readonly Sprint[]
  /** The Backlog's full count. */
  waiting: number
  /** The Backlog rows the create drawer's picker lists. */
  backlog: readonly Idea[]
  members: MemberOption[]
  canPlan: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const noticeRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span role="status">
          <b className="font-semibold text-foreground">{waiting}</b>{' '}
          {waiting === 1 ? 'task waiting' : 'tasks waiting'} in the Backlog
        </span>
        {canPlan ? (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => {
              setNotice('')
              setCreating(true)
            }}
          >
            + New sprint
          </Button>
        ) : null}
      </div>
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

      {sprints.length === 0 ? (
        <EmptyState heading="No sprints yet">
          {canPlan
            ? `Create the first sprint for ${boardName} and pick the tasks it starts with.`
            : `${boardName} has no sprints yet.`}
        </EmptyState>
      ) : (
        <ul
          aria-label={`Sprints on ${boardName}`}
          className="m-0 flex list-none flex-col gap-2 p-0"
        >
          {sprints.map((sprint) => (
            <li key={sprint.id}>
              <Link
                href={
                  `/boards/${encodeURIComponent(boardId)}/sprints/${encodeURIComponent(sprint.id)}` as Route
                }
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-4 py-3 text-foreground no-underline hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{sprint.name}</span>
                  {sprint.goal ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {sprint.goal}
                    </span>
                  ) : null}
                </span>
                <SprintStateChip state={sprint.state} />
                <span className="text-xs text-muted-foreground tabular-nums">{sprint.window}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {plural(sprint.issueCount, 'task')}
                  {sprint.state === 'Completed' ? ` · ${sprint.doneCount} done` : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canPlan ? (
        <SprintCreateDrawer
          open={creating}
          onClose={() => setCreating(false)}
          boardId={boardId}
          boardName={boardName}
          tasks={backlog}
          total={waiting}
          initialIds={[]}
          members={members}
          onCreated={(count) => {
            setCreating(false)
            setNotice(`Sprint created with ${plural(count, 'task')}.`)
          }}
        />
      ) : null}
    </div>
  )
}
