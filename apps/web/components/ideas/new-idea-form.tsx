'use client'

import { Alert, Button, Field, Input, Select, Textarea } from '@collega/design-system'
import { useActionState, useEffect, useRef } from 'react'
import type { Board, IdeaOptions } from '@/lib/data'
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
 * **Rendered only for a role that may author.** The refusal is the call site's, through
 * `GatedAction`, which renders the identical `Denied` + `aria-disabled` button from the same
 * `writeDenial` copy — so a Read Only account and a Site Admin still see the control with its
 * reason beside it, never a hole where the topbar action was. Keeping the branch out of here is
 * what stops a denied reader downloading an entire dialog, a server-action reference and
 * `useActionState` in order to be shown a button they cannot press.
 *
 * ## The board field, and why it only sometimes exists
 *
 * `POST /boards/{boardId}/ideas` needs a board, and comp P's create column has no board field
 * because it is docked onto a board — the breadcrumb reads `Boards / Ideas` and the column's own
 * meta line names the board. There, the board is context and asking for it again would be a
 * question the screen has already answered.
 *
 * `/ideas` is every board at once, so it has no such answer. Comp P routes its topbar `New idea`
 * through the brainstorm screen, which lands the person on a board and supplies the context that
 * way; that screen does not exist yet. Choosing a board on their behalf is the one thing not to do
 * — an idea filed to the wrong board is a silent, wrong write — so when there is no board in
 * context the form asks, and only then.
 */
export function NewIdeaForm({
  boardId,
  boards,
  options,
}: {
  /** The board in context, or null on a screen that spans them all — see above. */
  boardId: string | null
  /** Offered only when `boardId` is null; ignored otherwise. */
  boards?: Board[]
  options: IdeaOptions
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [state, submit, pending] = useActionState(createIdea, IDLE)

  // Both catalogs are per-organization and both are required on `POST /boards/{id}/ideas`, so an
  // organization whose administrators archived every idea type renders a select with no options,
  // posts an empty id and gets "Idea Type not found" back — a configuration state wearing the
  // clothes of a bug. Saying so, and refusing to submit, is the difference.
  // A board with nothing to file against is the same shape of problem, and reachable the same way:
  // an organization whose only board was archived offers an empty picker, posts an empty id and
  // gets a 404 that reads like a bug rather than like a board being needed first.
  const missing = [
    boardId === null && (boards ?? []).length === 0 ? 'boards' : null,
    options.ideaTypes.length === 0 ? 'idea types' : null,
    options.businessImpacts.length === 0 ? 'business impacts' : null,
  ].filter((catalog) => catalog !== null)

  // `state !== IDLE` is exactly "an action has resolved" — `useActionState` hands back the initial
  // object itself until one does, and every result is a fresh one. Comparing fields instead would
  // close the dialog on mount, because a clean result and the initial state hold the same values.
  useEffect(() => {
    if (state !== IDLE && state.error === null) dialog.current?.close()
  }, [state])

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
          {boardId === null
            ? 'It lands in the left-most lane of the board you choose.'
            : 'It lands in the left-most lane of this board.'}
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
              every one of them, so an Org Admin has to add them in Settings before one can be
              raised here.
            </span>
          </Alert>
        ) : null}

        <form action={submit}>
          {/* Same field name either way, so the action reads one `boardId` and never asks where it
              came from. */}
          {boardId === null ? (
            <Field htmlFor="idea-board" label="Board">
              <Select id="idea-board" name="boardId" required>
                {(boards ?? []).map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="boardId" value={boardId} />
          )}

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
