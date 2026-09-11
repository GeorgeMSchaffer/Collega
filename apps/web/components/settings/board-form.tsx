'use client'

import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@collega/design-system'
import Link from 'next/link'
import { useActionState } from 'react'
import { SwimlanePicker } from '@/components/settings/swimlane-picker'
import type { BoardFormState } from '@/lib/server/board-actions'
import { createBoard, saveBoard } from '@/lib/server/board-actions'
import type { Status } from '@/lib/types'

const IDLE: BoardFormState = { error: null }

/**
 * Create and edit are the same form with different seed values, so they are the same component.
 * The one thing edit does *not* add is a delete: a board's ideas outlive the board, and no screen
 * in comp Q offers to discard them as a side effect of tidying up the columns.
 *
 * `boardId` is what tells the two apart, and it decides the action rather than being a flag beside
 * one — a board with an id is saved, a board without one is created, and there is no third state
 * for the two to disagree about.
 *
 * The statuses arrive as a prop because `SwimlanePicker` cannot await, and the picker posts its own
 * hidden fields, so the order the person arranged is the order this form submits. Nothing about the
 * lanes is read back out of the picker by this component.
 *
 * **Not `@/lib/data` for the `Status` type.** That barrel re-exports the API-backed readers, which
 * reach `lib/api/client.ts` and its `server-only` import, so pulling a type through it drags the
 * whole module into the client graph and fails the build — the same trap `SwimlanePicker` documents.
 */
export function BoardForm({
  boardId,
  defaultName = '',
  userStatusMoves,
  swimlaneIds,
  statuses,
  submitLabel,
  explainerHeading,
}: {
  /** The board being edited, or null on the create route. */
  boardId: string | null
  defaultName?: string
  userStatusMoves: boolean
  swimlaneIds: string[]
  /** Drilled to `SwimlanePicker`, which is a client component and cannot read them itself. */
  statuses: Status[]
  submitLabel: string
  explainerHeading: string
}) {
  const [state, submit, pending] = useActionState(boardId === null ? createBoard : saveBoard, IDLE)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
      <Card>
        <CardContent>
          {state.error ? (
            <Alert variant="destructive" className="mb-4">
              <span>{state.error}</span>
            </Alert>
          ) : null}

          <form action={submit}>
            {boardId === null ? null : <input type="hidden" name="boardId" value={boardId} />}

            <Field
              htmlFor="board-name"
              label="Name"
              hint="Required. What this board is called everywhere it appears."
            >
              <Input id="board-name" name="name" defaultValue={defaultName} required />
            </Field>

            <div className="mb-4">
              <span className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="user-moves"
                  name="userStatusMoves"
                  defaultChecked={userStatusMoves}
                  className="mt-0.5"
                />
                <label htmlFor="user-moves" className="text-sm font-medium">
                  Let Users move ideas between statuses on this board
                </label>
              </span>
              <p className="m-0 mt-1 max-w-prose text-[0.8rem] text-muted-foreground">
                With this off, only administrators can change an idea&rsquo;s status here. Read Only
                accounts can never move anything, on any board.
              </p>
            </div>

            <div className="mb-3">
              <h2 className="m-0 text-sm font-semibold">Swimlanes</h2>
              <p className="m-0 mt-1 max-w-prose text-[0.8rem] text-muted-foreground">
                Pick from this organization&rsquo;s statuses. The order on the left is the
                left-to-right order of the board&rsquo;s columns.
              </p>
            </div>
            <SwimlanePicker selected={swimlaneIds} statuses={statuses} />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : submitLabel}
              </Button>
              <Link href="/settings/boards" className={buttonVariants({ variant: 'outline' })}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{explainerHeading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="m-0">
            A board groups ideas into columns. Which columns, and in what order, is what makes two
            boards in the same organization different from each other &mdash; they draw from one
            shared set of statuses.
          </p>
          <p className="m-0">
            Removing a swimlane does not delete the status, and does not delete the ideas sitting in
            it. Those ideas keep their status; they simply stop appearing on this board until the
            lane comes back.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
