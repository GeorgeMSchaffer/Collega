'use client'

import { Button, cn, Denied } from '@collega/design-system'
import { useActionState, useEffect, useState } from 'react'
import { type ActionState, addComment, toggleUpvote } from '@/lib/server/idea-actions'

const IDLE: ActionState = { error: null }

/**
 * `CreateCommentRequest.Body`'s limit, transcribed because the constant lives in `@collega/domain`.
 * The API enforces it either way; this only stops the browser letting someone type past it.
 */
const BODY_MAX_LENGTH = 2000

/**
 * The drawer's upvote control.
 *
 * Engagement and editing are gated separately on purpose: a Read Only account may vote and comment
 * but not edit, and a Site Admin may do none of it — not a member of the organization. `denial` is
 * `engagementDenial(role)`, never the write denial, or Read Only silently loses its vote.
 *
 * A denied vote stays a reachable control with its reason beside it (`Denied`), outside any form:
 * `aria-disabled` marks a control without inerting it, so inside the form it would still submit.
 */
export function UpvoteButton({
  ideaId,
  boardId,
  count,
  hasUpvoted,
  denial,
}: {
  ideaId: string
  boardId: string
  count: number
  hasUpvoted: boolean
  denial: string | null
}) {
  const [state, vote, voting] = useActionState(toggleUpvote, IDLE)

  if (denial) {
    return (
      <Denied reason={denial} id="why-upvote">
        <Button
          variant="outline"
          size="sm"
          aria-disabled="true"
          aria-describedby="why-upvote"
          aria-label={`Upvote this idea, currently ${count} votes`}
        >
          <span aria-hidden="true">▲</span> {count}
        </Button>
      </Denied>
    )
  }

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
      {state.error ? (
        <span role="status" className="text-xs font-medium text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

/**
 * The comment composer, with its `0 / 2000` counter.
 *
 * The textarea is **controlled**, so the counter reads `body.length` and a refused comment survives
 * the reset React performs when an action resolves. Clearing it is therefore explicit, on
 * `state !== IDLE` — "an action has resolved" — with no error.
 */
export function CommentBox({
  ideaId,
  boardId,
  denial,
}: {
  ideaId: string
  boardId: string
  denial: string | null
}) {
  const [state, post, posting] = useActionState(addComment, IDLE)
  const [body, setBody] = useState('')

  useEffect(() => {
    if (state !== IDLE && state.error === null) setBody('')
  }, [state])

  if (denial) {
    return (
      <p className="m-0 text-xs italic text-muted-foreground">
        {denial} — use View as&hellip; to comment as a member.
      </p>
    )
  }

  return (
    <form action={post} className="flex flex-col gap-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <input type="hidden" name="boardId" value={boardId} />
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
