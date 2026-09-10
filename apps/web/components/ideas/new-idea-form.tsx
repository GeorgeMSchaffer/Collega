'use client'

import { Alert, Button, Denied, Field, Input, Select, Textarea } from '@collega/design-system'
import { useActionState, useEffect, useRef } from 'react'
import type { IdeaOptions } from '@/lib/data'
import { type CreateIdeaState, createIdea } from '@/lib/server/idea-actions'

const IDLE: CreateIdeaState = { error: null, title: '', description: '' }

/** The priorities the API accepts, in the order the comps list them. */
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

/**
 * "New idea" on a board, as a modal form (comp Q's `s-board` topbar action).
 *
 * A native `<dialog>` rather than a component built out of a div: `showModal()` already does the
 * focus trap, the backdrop, Escape-to-close and the inert background, and every one of those is a
 * thing a hand-rolled modal gets subtly wrong. Nothing in the design system covers it yet, and one
 * screen is not enough to know what the shared version would need.
 *
 * The dialog closes when the action comes back clean, and stays open with the API's message on it
 * when it does not — an idea refused for a reason the person can fix (an empty title) is a reason to
 * still be looking at the form.
 *
 * The Denied branch is here rather than at the call site so the button is one component either way:
 * a Read Only account and a Site Admin see the same control, disabled with its reason beside it,
 * rather than a hole where the topbar action was.
 */
export function NewIdeaForm({
  boardId,
  options,
  denial,
}: {
  boardId: string
  /** Empty when the reader may not author, since the catalogs are only fetched if they may. */
  options: IdeaOptions
  denial: string | null
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [state, submit, pending] = useActionState(createIdea, IDLE)

  // Both catalogs are per-organization and both are required on `POST /boards/{id}/ideas`, so an
  // organization whose administrators archived every idea type renders a select with no options,
  // posts an empty id and gets "Idea Type not found" back — a configuration state wearing the
  // clothes of a bug. Saying so, and refusing to submit, is the difference.
  const missing = [
    options.ideaTypes.length === 0 ? 'idea types' : null,
    options.businessImpacts.length === 0 ? 'business impacts' : null,
  ].filter((catalog) => catalog !== null)

  // `state !== IDLE` is exactly "an action has resolved" — `useActionState` hands back the initial
  // object itself until one does, and every result is a fresh one. Comparing fields instead would
  // close the dialog on mount, because a clean result and the initial state hold the same values.
  useEffect(() => {
    if (state !== IDLE && state.error === null) dialog.current?.close()
  }, [state])

  if (denial) {
    return (
      <Denied reason={denial} id="why-new-board">
        <Button aria-disabled="true" aria-describedby="why-new-board">
          New idea
        </Button>
      </Denied>
    )
  }

  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>New idea</Button>

      <dialog
        ref={dialog}
        aria-labelledby="new-idea-heading"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border bg-card p-6 text-foreground shadow-lg backdrop:bg-black/40"
      >
        <h2 id="new-idea-heading" className="mt-0 mb-1 text-lg">
          New idea
        </h2>
        <p className="mt-0 mb-4 text-sm text-muted-foreground">
          It lands in the left-most lane of this board.
        </p>

        {state.error ? (
          <Alert variant="destructive" className="mb-4">
            <span>{state.error}</span>
          </Alert>
        ) : null}

        {missing.length > 0 ? (
          <Alert variant="destructive" className="mb-4">
            <span>
              This organization has no {missing.join(' and no ')} to choose from. An idea requires
              both, so an Org Admin has to add them in Settings before one can be raised here.
            </span>
          </Alert>
        ) : null}

        <form action={submit}>
          <input type="hidden" name="boardId" value={boardId} />

          <Field htmlFor="idea-title" label="Title">
            <Input
              id="idea-title"
              name="title"
              required
              maxLength={200}
              defaultValue={state.title}
            />
          </Field>

          <Field htmlFor="idea-description" label="Description">
            <Textarea
              id="idea-description"
              name="description"
              required
              defaultValue={state.description}
            />
          </Field>

          <Field htmlFor="idea-priority" label="Priority">
            <Select id="idea-priority" name="priority" defaultValue="Medium">
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="idea-type" label="Idea type">
            <Select id="idea-type" name="ideaTypeId" required>
              {options.ideaTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="idea-impact" label="Business impact">
            <Select id="idea-impact" name="businessImpactId" required>
              {options.businessImpacts.map((impact) => (
                <option key={impact.id} value={impact.id}>
                  {impact.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || missing.length > 0}>
              {pending ? 'Creating…' : 'Create idea'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
