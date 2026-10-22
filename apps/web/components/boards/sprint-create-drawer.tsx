'use client'

import { Button } from '@collega/design-system'
import { useEffect, useId, useState } from 'react'
import { SprintForm } from '@/components/delivery/sprint-form'
import { Drawer } from '@/components/list'
import { createBoardSprint } from '@/lib/server/sprint-planning-actions'
import type { Idea, MemberOption } from '@/lib/types'
import { SprintTaskPicker } from './sprint-task-picker'

const plural = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`

/**
 * *Create a sprint* on a work board (comp W screen 3 frame A): the sprint's fields, then the picker
 * of the board's unassigned tasks. The sprint and its tasks are one write, so a refused task (shown
 * under the picker with its key) leaves no sprint behind. `initialIds` are the Backlog's ticked rows.
 */
export function SprintCreateDrawer({
  open,
  onClose,
  boardId,
  boardName,
  tasks,
  initialIds,
  members,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  boardId: string
  boardName: string
  tasks: readonly Idea[]
  initialIds: readonly string[]
  members: MemberOption[]
  onCreated: (taskCount: number) => void
}) {
  const formId = useId()
  const [pending, setPending] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(initialIds))
  const [taskError, setTaskError] = useState<string | null>(null)

  // Each opening starts from what the Backlog had ticked.
  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialIds))
    setTaskError(null)
  }, [open, initialIds])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      eyebrow={`New sprint · ${boardName}`}
      title="Create a sprint"
      footer={
        <>
          <Button type="submit" form={formId} disabled={pending}>
            {pending
              ? 'Creating…'
              : selected.size > 0
                ? `Create sprint with ${plural(selected.size)}`
                : 'Create sprint'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {open ? (
        <SprintForm
          formId={formId}
          save={(input) => {
            setTaskError(null)
            return createBoardSprint(boardId, input, [...selected])
          }}
          members={members}
          onPendingChange={setPending}
          onRefused={(errors) => setTaskError(errors.ideaIds ?? null)}
          onCreated={() => onCreated(selected.size)}
        >
          <SprintTaskPicker
            tasks={tasks}
            selected={selected}
            onChange={(next) => {
              setTaskError(null)
              setSelected(next)
            }}
            error={taskError}
          />
          <p className="mt-3 mb-0 text-xs text-muted-foreground">
            Tasks already in a sprint are not listed. Picking none is fine: the sprint starts empty
            and tasks can be added later.
          </p>
        </SprintForm>
      ) : null}
    </Drawer>
  )
}
