import { Button } from '@collega/design-system'
import { endViewAs } from '@/lib/server/view-as-actions'
import { currentUser } from '@/lib/session'

/**
 * The strip that says you are not yourself.
 *
 * **It is rendered by the layout, above everything, and it is not dismissible.** Acting as someone
 * else changes what every screen means — a refusal you read as "this role cannot do that" is
 * actually about the target, and a write you make is attributed to them. Somebody who forgets they
 * are impersonating will misread the product and then report what they misread. So it is always
 * there, and it is compact: a label, not a sentence. Per `SPEC/decisions.md` 2026-10-01 ("The View
 * As banner names only the target") the visible text is *Viewing as: {Name}*; the acting admin and
 * the organization stay in the accessible text and the tooltip. Colours are theme tokens only.
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

  const detail = `You are signed in as ${viewing.realUserName}${
    user.organizationName ? ` · ${user.organizationName}` : ''
  }. Anything you do is recorded against both of you.`

  return (
    <div
      // `alert` rather than `status`: a screen reader should interrupt with this, because every
      // subsequent thing it reads out is about somebody else.
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-warning/40 bg-accent px-3 py-1 text-xs text-accent-foreground"
    >
      <p className="m-0">
        <strong className="font-semibold" title={detail}>
          Viewing as: {user.displayName}
        </strong>
        <span className="sr-only">. {detail}</span>
      </p>
      <form action={endViewAs}>
        <Button type="submit" size="sm" variant="outline" className="h-6 px-2">
          Stop viewing as
        </Button>
      </form>
    </div>
  )
}
