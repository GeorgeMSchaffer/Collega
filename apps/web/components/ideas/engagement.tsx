'use client'

import { Button, cn, Denied } from '@collega/design-system'
import { useActionState, useEffect, useId, useOptimistic, useState, useTransition } from 'react'
import { Icon } from '@/components/list/icons'
import { type ActionState, addComment, setFollowing, toggleUpvote } from '@/lib/server/idea-actions'

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

const followers = (n: number) => `${n} ${n === 1 ? 'person follows' : 'people follow'} this idea`

/**
 * The Follow / Following toggle (`20-feature-idea-following.md` rules 45–46).
 *
 * Saves at once, with no confirmation: the new state and count show immediately and fall back to
 * the detail's on a refusal, with the API's message beside the control. `denial` is
 * `followDenial(role)` — Read Only follows; only a Site Admin acting as themselves is refused.
 */
export function FollowButton({
  ideaId,
  boardId,
  isFollowing,
  followerCount,
  denial,
}: {
  ideaId: string
  boardId: string
  isFollowing: boolean
  followerCount: number
  denial: string | null
}) {
  const countId = useId()
  const [state, setState] = useOptimistic({ isFollowing, followerCount })
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (denial) {
    return (
      <Denied reason={denial} id="why-follow">
        <Button variant="outline" size="sm" aria-disabled="true" aria-describedby="why-follow">
          <Icon name="bell" />
          Follow · {followerCount}
          <span className="sr-only">, {followers(followerCount)}</span>
        </Button>
      </Denied>
    )
  }

  const toggle = () => {
    const follow = !state.isFollowing
    setError(null)
    startTransition(async () => {
      setState({ isFollowing: follow, followerCount: state.followerCount + (follow ? 1 : -1) })
      const result = await setFollowing(ideaId, boardId, follow)
      setError(result.error)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-pressed={state.isFollowing}
        aria-describedby={countId}
        onClick={toggle}
        className={cn(state.isFollowing && 'border-foreground/60 bg-muted text-foreground')}
      >
        <Icon name={state.isFollowing ? 'check' : 'bell'} />
        {state.isFollowing ? 'Following' : 'Follow'} · {state.followerCount}
      </Button>
      <span id={countId} className="sr-only">
        {followers(state.followerCount)}
      </span>
      {error ? (
        <span role="status" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </span>
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
