import { Button, Denied } from '@collega/design-system'
import { currentUser, engagementDenial } from '@/lib/session'
import { CommentForm, UpvoteForm } from './engagement-controls'

/**
 * Upvote and comment controls.
 *
 * Engagement and editing are gated separately on purpose (comp P, "Four roles, one panel"): a Read
 * Only account may vote and comment but not edit, and a Site Admin may do none of it — not a member
 * of the organization. Collapsing the two into one "can write" check silently takes voting away
 * from Read Only, which is the opposite of what the product intends.
 *
 * The gate lives here, in a Server Component, and the live control is a client one next door. That
 * split is what keeps a denied reader from downloading a form and a Server Function reference in
 * order to be shown a button they may not press — and it is only a courtesy either way: both
 * actions are HTTP endpoints anyone can post to, and the API refuses them on its own.
 */
export function UpvoteButton({
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
  const denial = engagementDenial(currentUser().role)

  if (denial) {
    return (
      <Denied reason={denial} id="why-upvote">
        {/* Outside any form, and `aria-disabled` rather than `disabled`, so the reason beside it
            stays reachable — `Denied`'s whole contract. */}
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

  return <UpvoteForm ideaId={ideaId} boardId={boardId} count={count} hasUpvoted={hasUpvoted} />
}

export function CommentBox({ ideaId }: { ideaId: string }) {
  const denial = engagementDenial(currentUser().role)

  if (denial) {
    return (
      <p className="m-0 text-xs italic text-muted-foreground">
        {denial} — use View as&hellip; to comment as a member.
      </p>
    )
  }

  return <CommentForm ideaId={ideaId} />
}
