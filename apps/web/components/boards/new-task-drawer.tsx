'use client'

import { Button, Field, Input, Select, Textarea } from '@collega/design-system'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useEffect, useId, useState, useTransition } from 'react'
import { AssigneesField, type ChosenTag, TagsField } from '@/components/ideas/idea-form'
import { Drawer } from '@/components/list'
import type { TaskParentChoice } from '@/lib/data'
import { addBacklogTask } from '@/lib/server/idea-actions'
import type { MemberOption, TagRef } from '@/lib/types'

/** The URL parameter that opens the drawer: `?task=new`, so a link and a reload both mean it. */
export const NEW_TASK_PARAM = 'task'

/**
 * Comp W screen 2: "Add a task" from a work board's Backlog. Title is the only required field; a
 * parent is optional and, left empty, makes a standalone task. Parent choices are the ideas the
 * server would accept, so the form never offers one it would refuse. "Save and add another" keeps
 * the drawer open on a fresh form.
 */
export function NewTaskDrawer({
  boardId,
  boardName,
  parents,
  members,
  tags,
}: {
  boardId: string
  boardName: string
  parents: readonly TaskParentChoice[]
  members: MemberOption[]
  tags: TagRef[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const open = params.get(NEW_TASK_PARAM) === 'new'
  // Bumped on close and after "Save and add another", so the form starts empty each time.
  const [formKey, setFormKey] = useState(0)
  // After "Save and add another" the next task starts in the Title; opening the drawer lands on its heading.
  const [again, setAgain] = useState(false)

  function close() {
    const next = new URLSearchParams(params)
    next.delete(NEW_TASK_PARAM)
    const query = next.toString()
    router.replace(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
    setFormKey((key) => key + 1)
    setAgain(false)
  }

  return (
    <Drawer open={open} onClose={close} eyebrow={`New task · ${boardName}`} title="Add a task">
      <NewTaskForm
        key={formKey}
        boardId={boardId}
        parents={parents}
        members={members}
        tags={tags}
        onDone={close}
        focusTitle={again}
        onAnother={() => {
          setFormKey((key) => key + 1)
          setAgain(true)
        }}
      />
    </Drawer>
  )
}

function NewTaskForm({
  boardId,
  parents,
  members,
  tags,
  onDone,
  onAnother,
  focusTitle,
}: {
  boardId: string
  parents: readonly TaskParentChoice[]
  members: MemberOption[]
  tags: TagRef[]
  onDone: () => void
  onAnother: () => void
  focusTitle: boolean
}) {
  const id = useId()
  const [title, setTitle] = useState('')
  const [parentId, setParentId] = useState('')
  const [description, setDescription] = useState('')
  const [assignees, setAssignees] = useState<MemberOption[]>([])
  const [chosenTags, setChosenTags] = useState<ChosenTag[]>([])
  const [tagText, setTagText] = useState('')
  const [titleError, setTitleError] = useState<string | undefined>()
  const [tagError, setTagError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  useEffect(() => {
    if (focusTitle) document.getElementById(`${id}-title`)?.focus()
  }, [focusTitle, id])

  function send(another: boolean) {
    const missing = title.trim() === '' ? 'Title is required.' : undefined
    const stray = tagText.trim()
      ? `Press Enter in Tags to add '${tagText.trim()}', or clear the text.`
      : undefined
    setTitleError(missing)
    setTagError(stray)
    if (missing || stray) return

    start(async () => {
      setError(null)
      const result = await addBacklogTask(boardId, {
        title: title.trim(),
        description: description.trim(),
        assigneeUserIds: assignees.map((person) => person.id),
        tagNames: chosenTags.map((tag) => tag.name),
        parentIdeaId: parentId || null,
      })
      if (result.error) setError(result.error)
      else if (another) onAnother()
      else onDone()
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send(false)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Add a task" className="flex flex-col">
      <Field htmlFor={`${id}-title`} label="Title" required error={titleError}>
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={150}
          required
          autoComplete="off"
          aria-invalid={titleError ? true : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field
        htmlFor={`${id}-parent`}
        label="Parent idea (optional)"
        hint="Lists ideas sitting in a lane that references this board. Leave empty for a standalone task."
      >
        <Select
          id={`${id}-parent`}
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">No parent (standalone task)</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.itemKey ? `${parent.itemKey} · ${parent.title}` : parent.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field htmlFor={`${id}-desc`} label="Description">
        <Textarea
          id={`${id}-desc`}
          rows={3}
          maxLength={4000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <AssigneesField
        id={`${id}-assignee`}
        assignees={assignees}
        members={members}
        locked={false}
        error={undefined}
        onChange={setAssignees}
      />
      <TagsField
        id={`${id}-tags`}
        tags={chosenTags}
        catalog={tags}
        error={tagError}
        text={tagText}
        onTextChange={setTagText}
        onChange={setChosenTags}
      />
      {error ? (
        <p role="alert" className="m-0 mb-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => send(true)}>
          Save and add another
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add task'}
        </Button>
      </div>
    </form>
  )
}
