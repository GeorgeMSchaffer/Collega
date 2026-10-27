import { getVisibleLoginMessages } from '@/lib/data/login-messages'
import { currentUser } from '@/lib/session'
import { LoginMessages } from './login-messages'

/**
 * Reads the visible set for the desk layout (LMS-3a). A message is a notice, not the page: if the
 * read fails, the desk renders without it rather than failing every screen.
 */
export async function LoginMessagesSlot() {
  const messages = await getVisibleLoginMessages().catch(() => [])
  if (messages.length === 0) return null
  return <LoginMessages messages={messages} organizationName={currentUser().organizationName} />
}
