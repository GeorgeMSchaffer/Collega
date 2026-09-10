'use client'

import { cn } from '@collega/design-system'
import { useActionState } from 'react'
import type { Idea } from '@/lib/data'
import { type ActionState, moveIdea, toggleUpvote } from '@/lib/server/idea-actions'

const IDLE: ActionState = { error: null }

const CHIP =
  'inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground'

const ARROW =
  'inline-flex size-6 items-center justify-center rounded-md border bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40'

/**
 * The two writes a card carries: toggle the upvote, move it one lane left or right.
 *
 * A client component, and only for what `useActionState` gives — a pending flag while the Server
 * Function is in flight, and the API's refusal to put beside the control if one comes back. Neither
 * form holds the value it posts in React state: the ids are hidden inputs and the target lane is
 * the submit button's own `value`, so the browser assembles the `FormData` and nothing here has to
 * stay in sync with the card it was rendered from.
 *
 * **Two submit buttons, one move form.** A submit button contributes its own `name`/`value` to the
 * submission, which is how one action serves both directions without a second form or an onClick.
 *
 * A card with no lane that way gets a `disabled` arrow rather than an `aria-disabled` one, which is
 * the opposite of what a *denied* control does (`GatedAction`): there is no reason to keep reachable
 * — the button is inert because the board ends there, and the lane beside it says so.
 */
export function CardActions({
  idea,
  boardId,
  previousStatusId,
  nextStatusId,
  canMove,
  canUpvote,
}: {
  idea: Idea
  boardId: string
  /** The lane to the left and to the right, or null at the ends of the board. */
  previousStatusId: string | null
  nextStatusId: string | null
  canMove: boolean
  canUpvote: boolean
}) {
  const [moveState, move, moving] = useActionState(moveIdea, IDLE)
  const [voteState, vote, voting] = useActionState(toggleUpvote, IDLE)

  const error = moveState.error ?? voteState.error

  return (
    <>
      {canUpvote ? (
        <form action={vote}>
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="ideaId" value={idea.id} />
          <button
            type="submit"
            disabled={voting}
            aria-pressed={idea.hasUpvoted}
            aria-label={`${idea.hasUpvoted ? 'Remove your upvote from' : 'Upvote'} ${idea.title}`}
            className={cn(
              CHIP,
              'hover:bg-accent',
              idea.hasUpvoted && 'border-primary text-primary',
            )}
          >
            <span aria-hidden="true">▲</span> {idea.upvotes}
          </button>
        </form>
      ) : (
        <span className={CHIP}>
          <span aria-hidden="true">▲</span> {idea.upvotes}
        </span>
      )}

      {canMove ? (
        <form action={move} className="flex items-center gap-1">
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="ideaId" value={idea.id} />
          <button
            type="submit"
            name="statusId"
            value={previousStatusId ?? ''}
            disabled={previousStatusId === null || moving}
            aria-label={`Move ${idea.title} one lane left`}
            className={ARROW}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="submit"
            name="statusId"
            value={nextStatusId ?? ''}
            disabled={nextStatusId === null || moving}
            aria-label={`Move ${idea.title} one lane right`}
            className={ARROW}
          >
            <span aria-hidden="true">→</span>
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="m-0 w-full text-[0.8rem] font-medium text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </>
  )
}
