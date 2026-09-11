'use client'

import { Button, cn } from '@collega/design-system'
import { useActionState } from 'react'
import { type ActionState, toggleUpvote } from '@/lib/server/idea-actions'

const IDLE: ActionState = { error: null }

/**
 * The live half of the inspector's engagement controls.
 *
 * A client component, and only for what `useActionState` gives: a pending flag while the Server
 * Function is in flight, and the API's refusal to put beside the control when one comes back. The
 * role gate stays in `engagement.tsx`, which is a Server Component and renders this only when the
 * role may act — so a refused reader downloads neither the form nor the action reference.
 *
 * The form holds nothing in React state: the two ids are hidden inputs, so the browser assembles
 * the `FormData` and this stays in step with the idea it was rendered from. Nothing encloses it, so
 * the submit is a real `type="submit"` button — the opposite of a *denied* control, which carries
 * `aria-disabled` and stays fully operable, and which is why `card-actions.tsx` keeps its denied
 * chip outside the vote form rather than inside it.
 */
export function UpvoteForm({
  ideaId,
  boardId,
  count,
  hasUpvoted,
}: {
  ideaId: string
  boardId: string
  count: number
  hasUpvoted: boolean
}) {
  const [state, vote, voting] = useActionState(toggleUpvote, IDLE)

  return (
    <form action={vote} className="inline-flex items-center gap-2">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="ideaId" value={ideaId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={voting}
        aria-pressed={hasUpvoted}
        aria-label={`${hasUpvoted ? 'Remove your upvote from' : 'Upvote'} this idea, currently ${count} votes`}
        className={cn(hasUpvoted && 'border-primary text-primary')}
      >
        <span aria-hidden="true">▲</span> {count}
      </Button>
      {/* Beside the control, like the reason a `Denied` chip carries — a refused vote and a denied
          one are the same shape of answer to the same press. */}
      {state.error ? (
        <span role="status" className="text-xs font-medium text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
