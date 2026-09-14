import { Button } from '@collega/design-system'
import { endViewAs } from '@/lib/server/view-as-actions'
import { currentUser } from '@/lib/session'

/**
 * The strip that says you are not yourself.
 *
 * **It is rendered by the layout, above everything, and it is not dismissible.** Acting as someone
 * else changes what every screen means — a refusal you read as "this role cannot do that" is
 * actually about the target, and a write you make is attributed to them. Somebody who forgets they
 * are impersonating will misread the product and then report what they misread. So this is
 * deliberately hard to miss rather than tasteful.
 *
 * It reads `viewingAs` from the acting principal, which comes from `GET /auth/me` on every request
 * rather than from what starting the session returned. That matters: the server can end a session
 * on its own — the two-hour cap, thirty minutes idle, the target being deactivated — and a banner
 * built from the start response would still be on screen afterwards, claiming an authority that no
 * longer exists.
 *
 * Nothing here is a client component. The form posts a Server Function and the page re-renders, so
 * the strip costs no JavaScript at all.
 */
export function ViewAsBanner() {
  const user = currentUser()
  const viewing = user.viewingAs

  if (!viewing) return null

  return (
    <div
      // `alert` rather than `status`: a screen reader should interrupt with this, because every
      // subsequent thing it reads out is about somebody else.
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="m-0">
        <strong className="font-semibold">Viewing as {user.displayName}</strong>
        {user.organizationName ? ` · ${user.organizationName}` : null} — you are signed in as{' '}
        {viewing.realUserName}. Anything you do is recorded against both of you.
      </p>
      <form action={endViewAs}>
        <Button type="submit" size="sm" variant="outline">
          Stop viewing as
        </Button>
      </form>
    </div>
  )
}
