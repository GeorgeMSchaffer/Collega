import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InboxWorkspace } from '@/components/inbox/inbox-workspace'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/server/inbox-actions'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser, InboxItem, NotificationEventType } from '@/lib/types'

/**
 * The inbox list (slice 153, `20-feature-idea-following.md` rules 40–44, and 154's `boardName`):
 * each row's wording and why-line, unread as ink with a screen-reader cue, opening a row marks it
 * read and opens its idea, Mark all read, the empty state, and the pager. The server actions and
 * the router are the boundary.
 */
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/inbox',
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/server/inbox-actions', () => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
vi.mock('@/lib/server/idea-actions', () => ({
  deleteIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  setFollowing: vi.fn(),
  moveIdea: vi.fn(),
}))

const markOne = vi.mocked(markNotificationRead)
const markAll = vi.mocked(markAllNotificationsRead)

const USER: CurrentUser = {
  userId: 'u-me',
  displayName: 'Olivia Admin',
  initials: 'OA',
  role: 'OrgAdmin',
  roleLabel: 'Org Admin',
  organizationId: 'org-1',
  organizationName: 'Acme',
  viewingAs: null,
}

function item(over: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'n-1',
    eventType: 'CommentAdded',
    ideaId: 'i-1',
    ideaTitle: 'Slow conveyor',
    actor: { name: 'Ada Lovelace', initials: 'AL' },
    statusName: null,
    boardName: 'Assembly',
    occurredAtUtc: '2026-10-01T11:30:00Z',
    when: '30 min ago',
    unread: true,
    ...over,
  }
}

function renderInbox(rows: InboxItem[], over: { total?: number; unread?: number } = {}) {
  return render(
    <SessionProvider user={USER}>
      <InboxWorkspace
        rows={rows}
        total={over.total ?? rows.length}
        unread={over.unread ?? rows.filter((r) => r.unread).length}
        boards={[]}
        statuses={[]}
        drawer={{ mode: null, idea: null, formOptions: null }}
      />
    </SessionProvider>,
  )
}

const rowFor = (title: string) =>
  screen.getByText(title, { selector: 'span' }).closest('button') as HTMLButtonElement
const markAllButton = () => screen.getByRole('button', { name: 'Mark all read' })

function deferred(fn: typeof markOne) {
  let settle: (result: { error: string | null }) => void = () => {}
  fn.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve
      }),
  )
  return (result: { error: string | null }) =>
    act(async () => {
      settle(result)
    })
}

beforeEach(() => {
  nav.push.mockReset()
  nav.replace.mockReset()
  nav.params = new URLSearchParams()
  markOne.mockReset()
  markOne.mockResolvedValue({ error: null })
  markAll.mockReset()
  markAll.mockResolvedValue({ error: null })
})

describe('a row’s wording', () => {
  const cases: [NotificationEventType, string, string | null, string, string][] = [
    [
      'CommentAdded',
      'commented on',
      null,
      'You follow this idea',
      'Ada Lovelace commented on Slow conveyor',
    ],
    [
      'IdeaMention',
      'mentioned you in',
      null,
      'You were mentioned',
      'Ada Lovelace mentioned you in Slow conveyor',
    ],
    [
      'CommentMention',
      'x',
      null,
      'You were mentioned',
      'Ada Lovelace mentioned you in a comment on Slow conveyor',
    ],
    [
      'IdeaStatusChanged',
      'x',
      'Review',
      'You follow this idea',
      'Ada Lovelace moved Slow conveyor to Review',
    ],
    [
      'IdeaStatusChanged',
      'x',
      null,
      'You follow this idea',
      'Ada Lovelace changed the status of Slow conveyor',
    ],
    [
      'IdeaPromoted',
      'x',
      null,
      'You follow this idea',
      'Ada Lovelace promoted Slow conveyor to an issue',
    ],
    [
      'IssueDeliveryStatusChanged',
      'x',
      'Complete',
      'You follow this idea',
      'Ada Lovelace moved Slow conveyor to Complete in delivery',
    ],
    [
      'IssueTaskAssigned',
      'x',
      null,
      'Assigned to you',
      'Ada Lovelace assigned you a task on Slow conveyor',
    ],
    ['IdeaEdited', 'x', null, 'You follow this idea', 'Ada Lovelace edited Slow conveyor'],
  ]

  it.each(cases)(
    '%s (status %s) reads as a sentence with its reason',
    (eventType, _v, statusName, why, sentence) => {
      renderInbox([item({ eventType, statusName, unread: false })])
      const button = rowFor('Slow conveyor')
      expect(button.textContent?.replace(/\s+/g, ' ')).toContain(sentence)
      expect(button.textContent).toContain(why)
    },
  )
})

describe('the board in the why-line (slice 154)', () => {
  it('reads {reason} · {boardName} when the idea’s board is known', () => {
    renderInbox([item({ boardName: 'Assembly' })])
    expect(screen.getByText('You follow this idea · Assembly')).toBeTruthy()
  })

  it('reads the reason alone when the board is unresolved', () => {
    renderInbox([item({ boardName: null })])
    expect(screen.getByText('You follow this idea')).toBeTruthy()
    expect(screen.queryByText(/·/)).toBeNull()
  })
})

describe('unread rows', () => {
  it('say Unread to a screen reader and are marked with an ink rule; read rows are not', () => {
    renderInbox([
      item({ id: 'n-1', ideaTitle: 'Fresh', unread: true }),
      item({ id: 'n-2', ideaTitle: 'Old', unread: false }),
    ])
    expect(within(rowFor('Fresh')).getByText('Unread:', { exact: false })).toBeTruthy()
    expect(rowFor('Fresh').className).toContain('shadow-[inset_3px_0_0_var(--color-foreground)]')
    expect(within(rowFor('Old')).queryByText('Unread:', { exact: false })).toBeNull()
    expect(rowFor('Old').className).not.toContain('inset_3px')
  })

  it('name an unknown actor rather than leaving the row blank', () => {
    renderInbox([item({ actor: null })])
    expect(screen.getByText('Unknown user')).toBeTruthy()
  })
})

describe('opening a row', () => {
  it('marks that one notification read and opens its idea in the drawer URL', async () => {
    renderInbox([item({ id: 'n-7', ideaId: 'i-9' })])
    await act(async () => {
      fireEvent.click(rowFor('Slow conveyor'))
    })
    expect(markOne).toHaveBeenCalledExactlyOnceWith('n-7')
    expect(nav.push.mock.calls.concat(nav.replace.mock.calls)[0]?.[0]).toBe('/inbox?idea=i-9')
  })

  it('shows it read at once, before the save answers', async () => {
    const answer = deferred(markOne)
    renderInbox([item()])
    await act(async () => {
      fireEvent.click(rowFor('Slow conveyor'))
    })
    expect(within(rowFor('Slow conveyor')).queryByText('Unread:', { exact: false })).toBeNull()
    await answer({ error: null })
  })

  it('does not mark an already-read row again, but still opens it', async () => {
    renderInbox([item({ unread: false })])
    await act(async () => {
      fireEvent.click(rowFor('Slow conveyor'))
    })
    expect(markOne).not.toHaveBeenCalled()
    expect(nav.push.mock.calls.concat(nav.replace.mock.calls)[0]?.[0]).toBe('/inbox?idea=i-1')
  })

  it('shows the API’s message when marking is refused', async () => {
    markOne.mockResolvedValue({ error: 'That notification is gone.' })
    renderInbox([item()])
    await act(async () => {
      fireEvent.click(rowFor('Slow conveyor'))
    })
    expect(screen.getByRole('alert').textContent).toContain('That notification is gone.')
  })
})

describe('Mark all read', () => {
  it('marks every row read at once and says so politely', async () => {
    const answer = deferred(markAll)
    renderInbox([item({ id: 'a', ideaTitle: 'One' }), item({ id: 'b', ideaTitle: 'Two' })])
    await act(async () => {
      fireEvent.click(markAllButton())
    })
    expect(markAll).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Unread:', { exact: false })).toBeNull()
    await answer({ error: null })
    expect(screen.getByRole('status').textContent).toBe('All notifications marked read.')
  })

  it('is aria-disabled, with the reason, and does nothing when nothing is unread', async () => {
    renderInbox([item({ unread: false })], { unread: 0 })
    const button = markAllButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Nothing is unread.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(markAll).not.toHaveBeenCalled()
  })

  it('counts unread across the whole inbox, not only this page', () => {
    renderInbox([item({ unread: false })], { total: 60, unread: 12 })
    expect(markAllButton().getAttribute('aria-disabled')).toBeNull()
  })

  it('shows the API’s message when refused', async () => {
    markAll.mockResolvedValue({ error: 'Try again.' })
    renderInbox([item()])
    await act(async () => {
      fireEvent.click(markAllButton())
    })
    expect(screen.getByRole('alert').textContent).toContain('Try again.')
  })
})

describe('an empty inbox', () => {
  it('says the reader is all caught up and shows no pager', () => {
    renderInbox([], { unread: 0 })
    expect(screen.getByText('You’re all caught up.')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
