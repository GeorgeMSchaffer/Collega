'use server'

/**
 * Marking the caller's notifications read: one when its inbox row is opened, or every one at once
 * (`SPEC/contracts/notifications.md`). Both are idempotent in the API, and neither takes a user —
 * the session cookie says whose inbox it is, and under View As that is the target's.
 *
 * Both revalidate the layout, not just `/inbox`: the sidebar's unread badge is rendered there.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost } from '../api/client'

export type InboxResult = { error: string | null }

/** A refusal's message; a 401 goes back to sign-in and anything that is not an answer rethrows. */
function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if ([400, 403, 404, 409].includes(error.status)) return error.detail
  }
  throw error
}

async function attempt(write: () => Promise<unknown>): Promise<InboxResult> {
  try {
    await write()
  } catch (error) {
    return { error: refusal(error) }
  }
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function markNotificationRead(notificationId: string): Promise<InboxResult> {
  return attempt(() => apiPost(apiPath`/notifications/${notificationId}/read`))
}

export async function markAllNotificationsRead(): Promise<InboxResult> {
  return attempt(() => apiPost(apiPath`/notifications/read-all`))
}
