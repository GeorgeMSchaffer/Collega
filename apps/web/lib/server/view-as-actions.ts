'use server'

/**
 * Starting and ending a View As session.
 *
 * **The session is server-side, and that is the whole security property.** `POST /auth/view-as`
 * opens a row; it does not reissue a token, and this file sets no cookie. So the browser holds the
 * same credential throughout, carrying no impersonation authority of its own — a captured token
 * grants nothing, and ending the session ends it everywhere at once rather than when a client
 * happens to notice.
 *
 * Nothing here consults a role. Authorization is the API's: `ViewAsService` re-reads the real user
 * from live state on every call, so a demoted or deactivated admin is refused at the moment they
 * try, not at the moment some cached claim expires. A client-side check would only duplicate a rule
 * that can change underneath it.
 *
 * `revalidatePath('/', 'layout')` after both: the acting principal changes, and every screen is
 * rendered from it — the sidebar's organization, the counts, what each screen decides you may do.
 * Revalidating the page alone would leave the shell describing whoever you were a moment ago.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiDelete, apiPath, apiPost } from '../api/client'

export type ViewAsState = { error: string | null }

function refusalText(error: unknown): string {
  // `detail` rather than `message`: `ApiError` keeps them apart because `message` is written for a
  // log line. This one is shown to a person.
  if (error instanceof ApiError && error.detail.length > 0) return error.detail
  return 'Could not start the session. Try again.'
}

export async function startViewAs(_previous: ViewAsState, form: FormData): Promise<ViewAsState> {
  const targetUserId = String(form.get('targetUserId') ?? '')

  try {
    await apiPost(apiPath`/auth/view-as`, { targetUserId })
  } catch (error) {
    return { error: refusalText(error) }
  }

  revalidatePath('/', 'layout')

  // Home rather than back to the picker: acting as someone is a change of vantage point, and the
  // first useful thing is seeing what they see. `redirect` throws, so it is last and outside `try`.
  redirect('/home')
}

/**
 * Ends the session.
 *
 * **Idempotent by contract** — `DELETE` answers 204 with no session open — so this never needs to
 * know whether one is running. A client that has lost track of state can always press it and get
 * back to a known position, which is the reason the banner offers it unconditionally.
 */
export async function endViewAs(): Promise<void> {
  try {
    await apiDelete(apiPath`/auth/view-as`)
  } catch {
    // Deliberately swallowed. The only job here is returning the person to themselves, and a
    // failure to end a session that may not exist must not strand them in someone else's view.
  }

  revalidatePath('/', 'layout')
  redirect('/home')
}
