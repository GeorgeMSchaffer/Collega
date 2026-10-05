'use client'

import { Alert, Avatar, Button, cn } from '@collega/design-system'
import { type ReactNode, useMemo, useOptimistic, useState, useTransition } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { type DrawerMode, IdeaDrawer } from '@/components/ideas/idea-drawer'
import { useDrawerUrl } from '@/components/ideas/use-drawer-url'
import { Pager, useListState } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { engagementDenial, followDenial, mayEditIdeaContent, writeDenial } from '@/lib/roles'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/server/inbox-actions'
import { useCurrentUser } from '@/lib/session-client'
import type {
  BoardRef,
  IdeaDetail,
  IdeaFormOptions,
  InboxItem,
  NotificationEventType,
  Status,
} from '@/lib/types'
import { INBOX_LIST } from './inbox-list-config'

const WHY_FOLLOW = 'You follow this idea'
const WHY_MENTION = 'You were mentioned'

/** Rule 42's table: what a row says between the actor and the title, after it, and why it came. */
function wording(item: InboxItem): { verb: string; tail: ReactNode; why: string } {
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

const STAMP = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

/** Marks one row read (its id), or every row (`null`). */
type MarkRead = string | null

/**
 * The inbox list (comp `comp-r-inbox.html`) with the idea drawer over it.
 *
 * Opening a row marks that one read and opens its idea at `/inbox?idea={id}` (Q10, Q11); **Mark
 * all read** marks the rest. Both show at once and settle when the revalidated page arrives — the
 * sidebar badge with it, since the actions revalidate the layout.
 */
export function InboxWorkspace({
  rows,
  total,
  unread,
  boards,
  statuses,
  drawer,
}: {
  rows: InboxItem[]
  total: number
  /** Unread across the whole inbox, not just this page. */
  unread: number
  boards: BoardRef[]
  statuses: Status[]
  drawer: { mode: DrawerMode | null; idea: IdeaDetail | null; formOptions: IdeaFormOptions | null }
}) {
  const user = useCurrentUser()
  const [state, update] = useListState(INBOX_LIST)
  const openDrawer = useDrawerUrl()
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [news, setNews] = useState('')
  const [, startTransition] = useTransition()

  const [inbox, markLocally] = useOptimistic({ rows, unread }, (current, id: MarkRead) => {
    if (id === null) {
      return { rows: current.rows.map((row) => ({ ...row, unread: false })), unread: 0 }
    }
    const wasUnread = current.rows.some((row) => row.id === id && row.unread)
    return {
      rows: current.rows.map((row) => (row.id === id ? { ...row, unread: false } : row)),
      unread: wasUnread ? current.unread - 1 : current.unread,
    }
  })

  const open = (item: InboxItem, from: HTMLElement) => {
    setTrigger(from)
    openDrawer({ view: item.ideaId })
    if (!item.unread) return
    setError(null)
    startTransition(async () => {
      markLocally(item.id)
      const result = await markNotificationRead(item.id)
      setError(result.error)
    })
  }

  const markAll = () => {
    if (inbox.unread === 0) return
    setError(null)
    setNews('')
    startTransition(async () => {
      markLocally(null)
      const result = await markAllNotificationsRead()
      setError(result.error)
      if (!result.error) setNews('All notifications marked read.')
    })
  }

  const boardsById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses])

  const idea = drawer.idea
  const board = idea ? boardsById.get(idea.boardId) : undefined
  // Archived boards are read-only, as on Ideas.
  const canEdit = idea !== null && writeDenial(user.role) === null && !board?.isArchived
  const mode = drawer.mode === 'edit' && !canEdit ? 'view' : drawer.mode
  const nothingUnread = inbox.unread === 0

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Comments, status changes and edits on ideas you follow, and anything that mentions you — the last 90 days, newest first."
        action={
          <span className="inline-flex flex-wrap items-center gap-2">
            {/* One button either way, so focus stays on it when marking all read disables it. */}
            <Button
              variant="outline"
              aria-disabled={nothingUnread || undefined}
              aria-describedby={nothingUnread ? 'why-mark-all' : undefined}
              onClick={markAll}
            >
              <Icon name="check" />
              Mark all read
            </Button>
            {nothingUnread ? (
              <span id="why-mark-all" className="text-xs italic text-muted-foreground">
                Nothing is unread.
              </span>
            ) : null}
          </span>
        }
      />

      <p role="status" className="sr-only">
        {news}
      </p>

      {error ? (
        <Alert variant="destructive" role="alert">
          <span>{error}</span>
        </Alert>
      ) : null}

      {inbox.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed bg-card px-6 py-10 text-center">
          <Icon name="bell" className="size-9 text-muted-foreground" />
          <h2 className="m-0 mt-2 text-lg">You&rsquo;re all caught up.</h2>
          <p className="m-0 max-w-[48ch] text-sm text-muted-foreground">
            Comments, status changes and edits on ideas you follow, and anything that mentions you,
            land here.
          </p>
        </div>
      ) : (
        <>
          <ul className="m-0 list-none overflow-hidden rounded-lg border bg-card p-0 [&>li+li]:border-t">
            {inbox.rows.map((item) => (
              <li key={item.id}>
                <InboxRow item={item} onOpen={open} />
              </li>
            ))}
          </ul>
          <Pager
            page={state.page}
            size={state.size}
            total={total}
            onPageChange={(page) => update({ page })}
            onSizeChange={(size) => update({ size })}
          />
        </>
      )}

      <IdeaDrawer
        mode={mode}
        idea={idea}
        boardName={board?.name ?? null}
        statusColor={idea ? statusById.get(idea.statusId)?.color : undefined}
        formOptions={drawer.formOptions}
        createBoards={null}
        createBoardId={null}
        canEdit={canEdit}
        canDelete={false}
        contentLocked={
          idea ? !mayEditIdeaContent(user.role, user.userId, idea.authorUserId) : false
        }
        engagementDenial={engagementDenial(user.role)}
        followDenial={followDenial(user.role)}
        returnFocusTo={trigger}
        onEdit={() => idea && openDrawer({ edit: idea.id })}
        onView={() => idea && openDrawer({ view: idea.id })}
        onClose={() => openDrawer(null)}
        onDelete={() => {}}
        onSaved={(ideaId) => openDrawer({ view: ideaId })}
      />
    </>
  )
}

/**
 * One notification. Unread is ink, never a hue (rule 43): a filled dot, a 3px rule on the left
 * edge, a bolder title and time, and "Unread:" for a screen reader.
 */
function InboxRow({
  item,
  onOpen,
}: {
  item: InboxItem
  onOpen: (item: InboxItem, from: HTMLElement) => void
}) {
  const { verb, tail, why } = wording(item)

  return (
    <button
      type="button"
      onClick={(event) => onOpen(item, event.currentTarget)}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[10px_28px_minmax(0,1fr)_auto] items-start gap-3 border-0 bg-transparent px-4 py-3 text-left hover:bg-muted/50',
        'max-md:grid-cols-[10px_28px_minmax(0,1fr)]',
        item.unread && 'shadow-[inset_3px_0_0_var(--color-foreground)]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('mt-2.5 size-2 rounded-full', item.unread && 'bg-foreground')}
      />
      <Avatar initials={item.actor?.initials ?? '—'} />
      <span className="min-w-0">
        <span className={item.unread ? 'text-foreground' : 'text-foreground/80'}>
          {item.unread ? <span className="sr-only">Unread: </span> : null}
          <b className="font-semibold text-foreground">{item.actor?.name ?? 'Unknown user'}</b>{' '}
          {verb}{' '}
          <span className={cn('text-foreground', item.unread ? 'font-bold' : 'font-medium')}>
            {item.ideaTitle}
          </span>
          {tail}
        </span>
        <span className="block text-xs text-muted-foreground">
          {item.boardName ? `${why} · ${item.boardName}` : why}
        </span>
      </span>
      <time
        dateTime={item.occurredAtUtc}
        title={STAMP.format(new Date(item.occurredAtUtc))}
        className={cn(
          'mt-0.5 whitespace-nowrap text-xs max-md:col-start-3',
          item.unread ? 'font-semibold text-foreground/80' : 'text-muted-foreground',
        )}
      >
        {item.when}
      </time>
    </button>
  )
}
