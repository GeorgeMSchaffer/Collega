import { getVisibleLoginMessages } from '@/lib/data/login-messages'
import { signInMessagesDue } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'
import { LoginMessages } from './login-messages'

/**
 * Reads the visible set for the desk layout, on the first desk page after signing in only (LMS-3a).
 * A message is a notice, not the page: if the read fails, the desk renders without it rather than
 * failing every screen.
 *
 * `<LoginMessages>` is rendered on every page, with nothing to show after the first, so that the
 * set it was given survives the layout re-rendering while the reader works through it.
 */
export async function LoginMessagesSlot() {
  const due = await signInMessagesDue()
  // A failed read keeps the marker, so the next page tries again rather than losing this sign-in's.
  const messages = due ? await getVisibleLoginMessages().catch(() => null) : []
  return (
    <LoginMessages
      messages={messages ?? []}
      due={due && messages !== null}
      organizationName={currentUser().organizationName}
    />
  )
}
