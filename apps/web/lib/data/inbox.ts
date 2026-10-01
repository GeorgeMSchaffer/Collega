/**
 * The caller's notification inbox (`SPEC/20-feature-idea-following.md` rules 20–32).
 *
 * Every route here is the caller's own — under View As, the target's — so nothing is scoped by
 * organization and nothing names a user. A Site Admin acting as themselves gets an empty page and a
 * zero from the API; the sidebar does not ask on their behalf (`hasInbox`).
 */

import { toInboxItem } from '../api/adapt'
import { apiGet, apiPath, withQuery } from '../api/client'
import type { WireNotification, WirePage } from '../api/wire'
import type { InboxPage } from '../types'

export type { InboxItem, InboxPage, NotificationEventType } from '../types'

/** One page of the inbox, newest first — the API's one order. */
export async function getInbox(query: { page: number; pageSize: number }): Promise<InboxPage> {
  const result = await apiGet<WirePage<WireNotification>>(
    'getInbox',
    withQuery(
      apiPath`/notifications`,
      new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) }),
    ),
  )
  const now = new Date()
  return {
    items: result.items.map((item) => toInboxItem(item, now)),
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
  }
}

/** Unread notifications in the inbox's window, uncapped; the badge shows `99+`. */
export async function getUnreadCount(): Promise<number> {
  const result = await apiGet<{ unreadCount: number }>(
    'getUnreadCount',
    apiPath`/notifications/unread-count`,
  )
  return result.unreadCount
}
