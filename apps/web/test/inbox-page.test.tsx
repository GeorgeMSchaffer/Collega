import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InboxPage from '@/app/(desk)/inbox/page'
import { getBoardRefs, getInbox, getStatuses, getUnreadCount } from '@/lib/data'
import { currentUser } from '@/lib/session'
import { SessionProvider } from '@/lib/session-client'
import type { InboxItem } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * `/inbox` (slice 153): which readers it calls and with what paging, a page past the end showing the
 * last page, the unread count passed on, and the "could not be opened" notice for an idea the
 * drawer cannot load. The readers, the drawer loader and the router are the boundary.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/inbox',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: vi.fn(async () => ({})) }))
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
vi.mock('@/lib/data', () => ({
  getInbox: vi.fn(),
  getUnreadCount: vi.fn(),
  getBoardRefs: vi.fn(),
  getStatuses: vi.fn(),
}))
const loadDrawer = vi.hoisted(() => vi.fn())
vi.mock('@/components/ideas/load-idea-drawer', () => ({ loadIdeaDrawer: loadDrawer }))

function row(id: string, title: string): InboxItem {
  return {
    id,
    eventType: 'CommentAdded',
    ideaId: `idea-${id}`,
    ideaTitle: title,
    actor: { name: 'Ada Lovelace', initials: 'AL' },
    statusName: null,
    boardName: 'Assembly',
    occurredAtUtc: '2026-10-01T11:30:00Z',
    when: '30 min ago',
    unread: true,
  }
}

const NO_DRAWER = { mode: null, idea: null, formOptions: null, missing: false }

async function renderPage(params: Record<string, string> = {}) {
  const page = await InboxPage({ searchParams: Promise.resolve(params) })
  render(<SessionProvider user={currentUser()}>{page}</SessionProvider>)
}

beforeEach(() => {
  actAs('User')
  vi.mocked(getInbox).mockReset()
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(1)
  vi.mocked(getBoardRefs).mockReset().mockResolvedValue([])
  vi.mocked(getStatuses).mockReset().mockResolvedValue([])
  loadDrawer.mockReset().mockResolvedValue(NO_DRAWER)
  vi.mocked(getInbox).mockResolvedValue({
    items: [row('n-1', 'Slow conveyor')],
    page: 1,
    pageSize: 25,
    totalCount: 1,
  })
})

describe('the inbox page', () => {
  it('lists the rows the inbox answers', async () => {
    await renderPage()
    expect(screen.getByText('Slow conveyor')).toBeTruthy()
    expect(vi.mocked(getInbox)).toHaveBeenCalledTimes(1)
  })

  it('asks for the page the URL names, at the size it names', async () => {
    await renderPage({ page: '2', size: '10' })
    expect(vi.mocked(getInbox).mock.calls[0]?.[0]).toMatchObject({ page: 2, pageSize: 10 })
  })

  it('reads the unread count once', async () => {
    await renderPage()
    expect(getUnreadCount).toHaveBeenCalledTimes(1)
  })

  it('shows the last page when the one asked for is past the end', async () => {
    vi.mocked(getInbox)
      .mockResolvedValueOnce({ items: [], page: 5, pageSize: 10, totalCount: 23 })
      .mockResolvedValueOnce({
        items: [row('n-9', 'Last page row')],
        page: 3,
        pageSize: 10,
        totalCount: 23,
      })
    await renderPage({ page: '5', size: '10' })
    expect(vi.mocked(getInbox)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getInbox).mock.calls[1]?.[0]).toMatchObject({ page: 3, pageSize: 10 })
    expect(screen.getByText('Last page row')).toBeTruthy()
  })

  it('does not ask a second time for an empty inbox on page one', async () => {
    vi.mocked(getInbox).mockResolvedValue({ items: [], page: 1, pageSize: 25, totalCount: 0 })
    await renderPage()
    expect(vi.mocked(getInbox)).toHaveBeenCalledTimes(1)
    expect(screen.getByText('You’re all caught up.')).toBeTruthy()
  })

  it('reads boards and statuses only when the drawer has an idea open', async () => {
    await renderPage()
    expect(getBoardRefs).not.toHaveBeenCalled()
    expect(getStatuses).not.toHaveBeenCalled()
  })

  it('tells the reader when the idea in the URL could not be opened', async () => {
    loadDrawer.mockResolvedValue({ ...NO_DRAWER, missing: true })
    await renderPage({ idea: 'gone' })
    expect(screen.getByText(/That idea could not be opened\./)).toBeTruthy()
  })

  it('never opens the drawer in create mode from here', async () => {
    await renderPage({ new: '1', idea: 'i-1' })
    const params = loadDrawer.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params.new).toBeUndefined()
    expect(params.idea).toBe('i-1')
  })
})
