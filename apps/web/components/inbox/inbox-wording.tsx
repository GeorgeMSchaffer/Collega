import type { ReactNode } from 'react'
import type { InboxItem, NotificationEventType } from '@/lib/types'

const WHY_FOLLOW = 'You follow this idea'
const WHY_MENTION = 'You were mentioned'

/** Rule 42's table: what a row says between the actor and the title, after it, and why it came. */
export function wording(item: InboxItem): { verb: string; tail: ReactNode; why: string } {
  const status = item.statusName
  const kinds: Record<NotificationEventType, { verb: string; tail: ReactNode; why: string }> = {
    IdeaMention: { verb: 'mentioned you in', tail: null, why: WHY_MENTION },
    CommentMention: { verb: 'mentioned you in a comment on', tail: null, why: WHY_MENTION },
    CommentAdded: { verb: 'commented on', tail: null, why: WHY_FOLLOW },
    // A status row written before the column existed has no name, and says so less precisely.
    IdeaStatusChanged: status
      ? {
          verb: 'moved',
          tail: (
            <>
              {' '}
              to <b className="font-semibold">{status}</b>
            </>
          ),
          why: WHY_FOLLOW,
        }
      : { verb: 'changed the status of', tail: null, why: WHY_FOLLOW },
    IdeaPromoted: { verb: 'promoted', tail: ' to an issue', why: WHY_FOLLOW },
    IssueDeliveryStatusChanged: status
      ? {
          verb: 'moved',
          tail: (
            <>
              {' '}
              to <b className="font-semibold">{status}</b> in delivery
            </>
          ),
          why: WHY_FOLLOW,
        }
      : { verb: 'changed the delivery status of', tail: null, why: WHY_FOLLOW },
    IssueTaskAssigned: { verb: 'assigned you a task on', tail: null, why: 'Assigned to you' },
    IdeaEdited: { verb: 'edited', tail: null, why: WHY_FOLLOW },
  }
  return kinds[item.eventType] ?? kinds.IdeaEdited
}
