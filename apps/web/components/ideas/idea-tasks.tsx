'use client'

import { Button, cn, Dot, Field, Input, Textarea } from '@collega/design-system'
import Link from 'next/link'
import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { blockedBadge, blockedTooltip, isBlockedHere } from '@/lib/board-work'
import { addBoardTask, moveIdea, removeBoardTask } from '@/lib/server/idea-actions'
import type { BoardTask, IdeaDetail, IdeaTasks } from '@/lib/types'
import { WARN_BADGE } from './idea-badges'
import { People } from './idea-chips'
import { AssigneesField, type ChosenTag, TagsField } from './idea-form'

type Parent = Pick<IdeaDetail, 'id' | 'boardId' | 'title' | 'itemKey'>

/** Moves the parent with the card's own `moveIdea`, so the same rules decide it. */
function moveForm(parent: Parent, statusId: string): FormData {
  const form = new FormData()
  form.set('boardId', parent.boardId ?? '')
  form.set('ideaId', parent.id)
  form.set('statusId', statusId)
  form.set('title', parent.title)
  return form
}

/**
 * The completion prompt (comp U screen 4, frame B): every task is in a final lane, so the drawer
 * offers the move out of the reference lane. Nothing moves by itself; Not yet dismisses it until the
 * drawer is opened again. Key it by idea so one idea's dismissal is not another's.
 */
export function TasksCompletePrompt({ parent, tasks }: { parent: Parent; tasks: IdeaTasks }) {
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const { nextLane } = tasks
  if (
    dismissed ||
    !tasks.inLane ||
    !tasks.canMove ||
    !nextLane ||
    tasks.tasks.length === 0 ||
    !tasks.tasks.every((task) => task.isFinal)
  ) {
    return null
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-dashed border-success/60 bg-success/10 p-3 text-sm"
    >
      <span aria-hidden="true">✦</span>
      <div className="min-w-0 flex-1">
        <b>All {tasks.tasks.length} tasks are complete.</b> Move to {nextLane.name}?
        {error ? <div className="mt-1 text-xs font-semibold text-destructive">{error}</div> : null}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const result = await moveIdea({ error: null }, moveForm(parent, nextLane.id))
              if (result.error) setError(result.error)
            })
          }
        >
          {pending ? 'Moving…' : 'Move'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Not yet
        </Button>
      </div>
    </div>
  )
}

/**
 * The drawer's Tasks section (comp U screen 4): the parent's tasks in creation order, + Add task and
 * a remove action for whoever may edit the parent (hidden for everyone else), and the "Move back"
 * step when the parent is already past the reference lane. A title opens the task on its own board,
 * with its own drawer; no second drawer is stacked on this one (decided 2026-10-20).
 */
export function TasksSection({ parent, tasks }: { parent: Parent; tasks: IdeaTasks }) {
  const [adding, setAdding] = useState(false)
  const [moveBack, setMoveBack] = useState(false)
  const [removing, setRemoving] = useState<BoardTask | null>(null)

  const done = tasks.tasks.filter((task) => task.isFinal).length
  const formAnchor = useId()
  const addWrap = useRef<HTMLSpanElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const refocusAdd = useRef(false)

  // Closing the form puts focus back on the button that opened it; a delete, whose row (and button)
  // goes, lands on the heading. Both stay inside the drawer.
  const refocusHeading = useRef(false)
  useEffect(() => {
    // A removed row's dialog has restored focus to the row's button by now; take it to the heading.
    if (!removing && refocusHeading.current) {
      refocusHeading.current = false
      heading.current?.focus()
    }
  }, [removing])
  useEffect(() => {
    if (!adding && refocusAdd.current) {
      refocusAdd.current = false
      addWrap.current?.querySelector('button')?.focus()
    }
  }, [adding])

  return (
    <section aria-labelledby={`${formAnchor}-h`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3
          ref={heading}
          tabIndex={-1}
          id={`${formAnchor}-h`}
          className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Tasks
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          {done} of {tasks.tasks.length} done
        </span>
        <span className="flex-1" />
        {tasks.adding && !adding ? (
          <span ref={addWrap} className="contents">
            <Button
              size="sm"
              variant="outline"
              onClick={() => (tasks.inLane ? setAdding(true) : setMoveBack(true))}
            >
              <Icon name="plus" />
              Add task
            </Button>
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border">
        {tasks.tasks.length === 0 ? (
          <p className="m-0 p-3 text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <ul className="m-0 list-none divide-y p-0">
            {tasks.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                tasks={tasks}
                onRemove={tasks.adding ? () => setRemoving(task) : undefined}
              />
            ))}
          </ul>
        )}
        {tasks.adding && adding && tasks.inLane ? (
          <AddTaskForm
            parent={parent}
            tasks={tasks}
            adding={tasks.adding}
            onDone={() => {
              refocusAdd.current = true
              setAdding(false)
            }}
          />
        ) : null}
      </div>

      {moveBack ? (
        <MoveBackDialog
          parent={parent}
          tasks={tasks}
          onCancel={() => setMoveBack(false)}
          onMoved={() => {
            setMoveBack(false)
            setAdding(true)
          }}
        />
      ) : null}
      {removing ? (
        <RemoveTaskDialog
          parent={parent}
          task={removing}
          taskBoardId={tasks.referenced.id}
          onClose={(removed) => {
            refocusHeading.current = removed
            setRemoving(null)
          }}
        />
      ) : null}
    </section>
  )
}

function TaskRow({
  task,
  tasks,
  onRemove,
}: {
  task: BoardTask
  tasks: IdeaTasks
  onRemove: (() => void) | undefined
}) {
  const lane = tasks.referenced.lanes.find((candidate) => candidate.id === task.statusId)
  const blocked = isBlockedHere(
    { statusId: task.statusId, effort: null, taskCounts: null, blockedBy: task.blockedBy },
    tasks.referenced.lanes,
  )

  const [error, setError] = useState<string | null>(null)
  const errorId = `${useId()}-error`

  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <TaskTick
        task={task}
        tasks={tasks}
        errorId={error ? errorId : undefined}
        onError={setError}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/boards/${encodeURIComponent(tasks.referenced.id)}?idea=${encodeURIComponent(task.id)}`}
          className={cn(
            'w-fit max-w-full text-sm font-medium hover:underline',
            task.isFinal && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </Link>
        <span className="flex flex-wrap items-center gap-1.5">
          {task.itemKey ? (
            <span className="font-mono text-xs text-muted-foreground">{task.itemKey}</span>
          ) : null}
          {task.autoCreated ? (
            <span className="rounded border border-border px-1.5 font-mono text-[10.5px] leading-[17px] font-medium text-muted-foreground">
              auto-created
            </span>
          ) : null}
          {blocked ? (
            <span
              title={blockedTooltip(task)}
              className={cn(
                WARN_BADGE,
                'px-1.5 font-mono text-[10.5px] leading-[17px] font-medium',
              )}
            >
              <Icon name="lock" className="size-3" />
              {blockedBadge(task)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <Dot color={lane?.color} />
            {task.statusName}
          </span>
        </span>
        {error ? (
          <span id={errorId} role="alert" className="text-xs font-semibold text-destructive">
            {error}
          </span>
        ) : null}
      </div>
      <People people={task.assignees} />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete task ${task.itemKey ?? task.title}`}
          className="inline-grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Icon name="trash" />
        </button>
      ) : null}
    </li>
  )
}

/**
 * The row's status circle, and its checkbox for whoever may move (decided 2026-10-22). Checking
 * moves the task to its board's first final lane; unchecking, to the last lane that is not final,
 * since no lane history is kept. It is the card's own `moveIdea`, so blockers, the reference lock
 * and permissions refuse here as they do on the board; the row shows the refusal and the tick stays.
 */
function TaskTick({
  task,
  tasks,
  errorId,
  onError,
}: {
  task: BoardTask
  tasks: IdeaTasks
  errorId: string | undefined
  onError: (error: string | null) => void
}) {
  const [pending, start] = useTransition()

  const { lanes } = tasks.referenced
  const target = task.isFinal
    ? lanes.findLast((lane) => !lane.isFinal)
    : lanes.find((lane) => lane.isFinal)
  const circle = cn(
    'inline-grid size-[18px] shrink-0 place-items-center rounded-full border',
    task.isFinal ? 'border-success bg-success text-success-foreground' : 'border-input',
  )
  const tick = task.isFinal ? <Icon name="check" className="size-3" /> : null

  if (!tasks.canMove || !target) {
    return (
      <span role="img" aria-label={task.isFinal ? 'Done' : 'Open'} className={circle}>
        {tick}
      </span>
    )
  }

  function toggle(statusId: string) {
    start(async () => {
      onError(null)
      const form = moveForm(
        { id: task.id, boardId: tasks.referenced.id, title: task.title, itemKey: task.itemKey },
        statusId,
      )
      const blockers = task.blockedBy.filter((blocker) => !blocker.isFinal).length
      if (blockers > 0) form.set('blockers', String(blockers))
      const result = await moveIdea({ error: null }, form)
      if (result.error) onError(result.error)
    })
  }

  return (
    <button
      type="button"
      aria-pressed={task.isFinal}
      aria-label={`${task.title} done`}
      aria-describedby={errorId}
      disabled={pending}
      onClick={() => toggle(target.id)}
      className={cn(
        circle,
        'cursor-pointer hover:border-success focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60',
      )}
    >
      {tick}
    </button>
  )
}

function AddTaskForm({
  parent,
  tasks,
  adding,
  onDone,
}: {
  parent: Parent
  tasks: IdeaTasks
  adding: NonNullable<IdeaTasks['adding']>
  onDone: () => void
}) {
  const id = useId()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([])
  const [chosenTags, setChosenTags] = useState<ChosenTag[]>([])
  const [tagText, setTagText] = useState('')
  const [titleError, setTitleError] = useState<string | undefined>()
  const [tagError, setTagError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const firstLane = tasks.referenced.lanes[0]
  const formEl = useRef<HTMLFormElement>(null)

  // Not `autoFocus`: after Move back the dialog's focus restore runs in the same commit and would
  // take focus from a field focused on mount.
  useEffect(() => {
    const timer = setTimeout(
      () => formEl.current?.querySelector<HTMLInputElement>(`[id$="-title"]`)?.focus(),
      0,
    )
    return () => clearTimeout(timer)
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const missing = title.trim() === '' ? 'Title is required.' : undefined
    const stray = tagText.trim()
      ? `Press Enter in Tags to add '${tagText.trim()}', or clear the text.`
      : undefined
    setTitleError(missing)
    setTagError(stray)
    if (missing || stray) return

    start(async () => {
      setError(null)
      const result = await addBoardTask(parent.id, parent.boardId ?? '', tasks.referenced.id, {
        title: title.trim(),
        description: description.trim(),
        assigneeUserIds: assignees.map((person) => person.id),
        tagNames: chosenTags.map((tag) => tag.name),
      })
      if (result.error) setError(result.error)
      else onDone()
    })
  }

  return (
    <form
      ref={formEl}
      onSubmit={submit}
      noValidate
      aria-label="Add task"
      className="flex flex-col border-t bg-muted/40 p-3"
    >
      <Field htmlFor={`${id}-title`} label="Title" required error={titleError}>
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={150}
          required
          aria-invalid={titleError ? true : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field htmlFor={`${id}-desc`} label="Description">
        <Textarea
          id={`${id}-desc`}
          rows={2}
          maxLength={4000}
          placeholder="What needs doing"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <AssigneesField
        id={`${id}-assignee`}
        assignees={assignees}
        members={adding.members}
        locked={false}
        error={undefined}
        onChange={setAssignees}
      />
      <TagsField
        id={`${id}-tags`}
        tags={chosenTags}
        catalog={adding.tags}
        error={tagError}
        text={tagText}
        onTextChange={setTagText}
        onChange={setChosenTags}
      />
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        It will start in the first lane of the {tasks.referenced.name} board
        {firstLane ? ` (${firstLane.name})` : ''}, with its own key.
      </p>
      {error ? (
        <p role="alert" className="m-0 mb-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Adding…' : 'Add task'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/**
 * Frame C: a task can only be added while the idea is in the reference lane, and the API refuses
 * otherwise (`parentNotInReferenceLane`), so the person moves it back first, then adds.
 */
function MoveBackDialog({
  parent,
  tasks,
  onCancel,
  onMoved,
}: {
  parent: Parent
  tasks: IdeaTasks
  onCancel: () => void
  onMoved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const key = parent.itemKey ? ` (${parent.itemKey})` : ''

  return (
    <ConfirmDialog
      open
      destructive={false}
      title={`Move back to ${tasks.referenceLane.name}?`}
      description={`‘${parent.title}’${key} is past ${tasks.referenceLane.name}. A task can only be added while it is in ${tasks.referenceLane.name}.`}
      confirmLabel="Move back"
      pending={pending}
      onCancel={onCancel}
      onConfirm={() =>
        start(async () => {
          setError(null)
          const result = await moveIdea({ error: null }, moveForm(parent, tasks.referenceLane.id))
          if (result.error) setError(result.error)
          else onMoved()
        })
      }
    >
      {error ? (
        <p role="alert" className="m-0 mt-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}

function RemoveTaskDialog({
  parent,
  task,
  taskBoardId,
  onClose,
}: {
  parent: Parent
  task: BoardTask
  taskBoardId: string
  onClose: (removed: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const name = task.itemKey ?? `‘${task.title}’`

  return (
    <ConfirmDialog
      open
      title={`Delete task ${name}?`}
      description="It is deleted with its blocker links."
      confirmLabel="Delete task"
      pending={pending}
      onCancel={() => onClose(false)}
      onConfirm={() =>
        start(async () => {
          setError(null)
          const result = await removeBoardTask(
            parent.id,
            task.id,
            parent.boardId ?? '',
            taskBoardId,
          )
          if (result.error) setError(result.error)
          else onClose(true)
        })
      }
    >
      {error ? (
        <p role="alert" className="m-0 mt-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
