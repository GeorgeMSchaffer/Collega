'use client'

import { Button, cn } from '@collega/design-system'
import { useActionState, useEffect, useState } from 'react'
import { type ActionState, addComment, toggleUpvote } from '@/lib/server/idea-actions'

const IDLE: ActionState = { error: null }

/**
 * `CreateCommentRequest.Body`'s `[MaxLengthField(2000)]`, transcribed rather than imported: the
 * constant lives in `@collega/domain`, and `apps/web` may import `@collega/design-system` and
 * nothing else from the workspace. The API enforces it either way — this only stops the browser
 * letting someone type past a limit they would otherwise hear about from a 400.
 */
const BODY_MAX_LENGTH = 2000

/**
 * The live halves of the inspector's engagement controls.
 *
 * Client components, and only for what `useActionState` gives: a pending flag while the Server
 * Function is in flight, and the API's refusal to put beside the control when one comes back. The
 * role gate stays in `engagement.tsx`, which is a Server Component and renders these only when the
 * role may act — so a refused reader downloads neither form nor action reference.
 *
 * Neither form is nested inside another, so both submits are real `type="submit"` buttons. That is
 * the opposite of a *denied* control, which carries `aria-disabled` and stays fully operable — and
 * is why `card-actions.tsx` keeps its denied chip outside the vote form rather than inside it.
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

  // Neither id is held in React state: they are hidden inputs, so the browser assembles the
  // `FormData` and nothing here has to stay in step with the idea it was rendered from.
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
      {/* Beside the control, where a `Denied` chip puts its reason: a refused vote and a denied one
          are the same shape of answer to the same press. */}
      {state.error ? (
        <span role="status" className="text-xs font-medium text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

/**
 * The comment composer (comp P's "Add a comment", with its `0 / 2000` counter).
 *
 * The textarea is **controlled**, which buys two things for one piece of state: the counter reads
 * `body.length` rather than tracking the field separately, and a refused comment survives — React
 * resets a form once its action resolves, and an uncontrolled field would lose a paragraph of prose
 * to a 400 the way the create dialog once did. So `addComment` echoes nothing back, where
 * `createIdea` has to.
 *
 * Clearing it is therefore explicit, and `state !== IDLE` is exactly "an action has resolved":
 * `useActionState` hands back the initial object itself until one does, and every result is a fresh
 * one. Testing `error === null` alone would empty the box on mount.
 *
 * No client-side check for an empty body. The API answers that one in its own words like every
 * other refusal, and `disabled` on the submit would take the control out of the tab order for the
 * ordinary case of not having typed anything yet.
 */
export function CommentForm({ ideaId }: { ideaId: string }) {
  const [state, post, posting] = useActionState(addComment, IDLE)
  const [body, setBody] = useState('')

  useEffect(() => {
    if (state !== IDLE && state.error === null) setBody('')
  }, [state])

  return (
    <form action={post} className="flex flex-col gap-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <label htmlFor="comment" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="comment"
        name="body"
        rows={2}
        maxLength={BODY_MAX_LENGTH}
        required
        placeholder="Add a comment…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {state.error ? (
        <p className="m-0 text-[0.8rem] font-medium text-destructive" role="status">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button size="sm" type="submit" disabled={posting}>
          {posting ? 'Posting…' : 'Comment'}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {body.length} / {BODY_MAX_LENGTH}
        </span>
      </div>
    </form>
  )
}
