import { getUnreadCount } from '@/lib/data'

/**
 * The sidebar badge's refresh (`components/nav/inbox-link.tsx`). A route rather than a Server
 * Function: it is a read, polled every minute, and Server Functions run one at a time per client —
 * a poll would queue behind, or ahead of, a save the reader is waiting on.
 */
export async function GET(): Promise<Response> {
  return Response.json({ unreadCount: await getUnreadCount() })
}
