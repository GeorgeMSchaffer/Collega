import { act, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as unreadCountRoute } from '@/app/(desk)/inbox/unread-count/route'
import { InboxLink } from '@/components/nav/inbox-link'
import { Sidebar } from '@/components/nav/sidebar'
import { getNavCounts, getUnreadCount } from '@/lib/data'
import { actAs } from './support/acting-role'

/**
 * The sidebar's Inbox item and its unread badge (slice 153, rule 40): the server's count, `99+`,
 * the accessible name, a refresh on navigation and on a one-minute tick while the tab is visible,
 * a failed refresh keeping the last count, a revalidated layout beating a stale fetch, and no count
 * asked for on a Site Admin's behalf. Fetch, the clock and the readers are the boundary.
 */
const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/data', () => ({ getNavCounts: vi.fn(), getUnreadCount: vi.fn() }))
vi.mock('@/components/nav/sidebar-nav', () => ({
  SidebarNav: (props: unknown) => <pre data-testid="sidebar-nav">{JSON.stringify(props)}</pre>,
}))

const CLASS = 'nav-link'
const fetchMock = vi.fn()

function count(n: number) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ unreadCount: n }) })
}

const link = () => screen.getByRole('link', { name: /Inbox/ })
const badge = () => document.querySelector('[aria-hidden="true"].rounded-full')

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

function renderLink(initial: { count: number; at: number } | undefined, el?: ReactElement) {
  return render(el ?? <InboxLink className={CLASS} initialUnread={initial} />)
}

beforeEach(() => {
  vi.useFakeTimers()
  nav.pathname = '/'
  fetchMock.mockReset()
  count(0)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('InboxLink', () => {
  it('shows the server’s count in an aria-hidden pill and names it for a screen reader', async () => {
    count(3)
    renderLink({ count: 3, at: 1 })
    await flush()
    expect(badge()?.textContent).toBe('3')
    expect(link().getAttribute('aria-label')).toBe('Inbox, 3 unread')
  })

  it('shows no badge and no label override at zero', async () => {
    renderLink({ count: 0, at: 1 })
    await flush()
    expect(badge()).toBeNull()
    expect(link().getAttribute('aria-label')).toBeNull()
  })

  it('caps the pill at 99+ while the name keeps the real number', async () => {
    count(137)
    renderLink({ count: 137, at: 1 })
    await flush()
    expect(badge()?.textContent).toBe('99+')
    expect(link().getAttribute('aria-label')).toBe('Inbox, 137 unread')
  })

  it('shows 99 as 99', async () => {
    count(99)
    renderLink({ count: 99, at: 1 })
    await flush()
    expect(badge()?.textContent).toBe('99')
  })

  it('links to /inbox and marks the current page there', async () => {
    nav.pathname = '/inbox'
    renderLink({ count: 0, at: 1 })
    await flush()
    expect(link().getAttribute('href')).toBe('/inbox')
    expect(link().getAttribute('aria-current')).toBe('page')
  })

  it('is not the current page elsewhere', async () => {
    renderLink({ count: 0, at: 1 })
    await flush()
    expect(link().getAttribute('aria-current')).toBeNull()
  })

  it('asks the unread-count route without caching, on mount', async () => {
    renderLink({ count: 0, at: 1 })
    await flush()
    expect(fetchMock).toHaveBeenCalledWith('/inbox/unread-count', { cache: 'no-store' })
  })

  it('shows the fetched count when it differs from the server’s', async () => {
    count(8)
    renderLink({ count: 2, at: 1 })
    await flush()
    expect(badge()?.textContent).toBe('8')
  })

  it('asks again on every navigation', async () => {
    const view = renderLink({ count: 0, at: 1 })
    await flush()
    fetchMock.mockClear()
    count(5)
    nav.pathname = '/ideas'
    view.rerender(<InboxLink className={CLASS} initialUnread={{ count: 0, at: 1 }} />)
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(badge()?.textContent).toBe('5')
  })

  it('asks again each minute while the tab is visible', async () => {
    renderLink({ count: 0, at: 1 })
    await flush()
    fetchMock.mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not ask on the tick while the tab is hidden', async () => {
    renderLink({ count: 0, at: 1 })
    await flush()
    fetchMock.mockClear()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the last count when a refresh fails or answers an error', async () => {
    count(4)
    renderLink({ count: 4, at: 1 })
    await flush()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(badge()?.textContent).toBe('4')
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ unreadCount: 0 }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(badge()?.textContent).toBe('4')
  })

  it('lets a revalidated layout’s count win over one fetched since, even when equal', async () => {
    count(9)
    const view = renderLink({ count: 3, at: 1 })
    await flush()
    expect(badge()?.textContent).toBe('9')
    // The layout re-rendered after a mark-read, with a newer timestamp and the same server count.
    fetchMock.mockClear()
    view.rerender(<InboxLink className={CLASS} initialUnread={{ count: 3, at: 2 }} />)
    expect(badge()?.textContent).toBe('3')
  })

  it('stops ticking when it unmounts', async () => {
    const view = renderLink({ count: 0, at: 1 })
    await flush()
    view.unmount()
    fetchMock.mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Sidebar (the server half)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    vi.mocked(getNavCounts).mockResolvedValue({ boards: 1, ideas: 2, backlog: 3 })
    vi.mocked(getUnreadCount).mockReset()
  })

  async function handedDown() {
    render(await Sidebar())
    return JSON.parse(screen.getByTestId('sidebar-nav').textContent ?? '{}')
  }

  it('hands the sidebar the unread count and the instant it was rendered', async () => {
    actAs('User')
    vi.mocked(getUnreadCount).mockResolvedValue(6)
    const props = await handedDown()
    expect(props.unread).toEqual({ count: 6, at: new Date('2026-10-01T12:00:00Z').getTime() })
  })

  it.each(['OrgAdmin', 'User', 'ReadOnly'] as const)('reads the count for a %s', async (role) => {
    actAs(role)
    vi.mocked(getUnreadCount).mockResolvedValue(1)
    await handedDown()
    expect(getUnreadCount).toHaveBeenCalledTimes(1)
  })

  it('never asks on a Site Admin’s behalf and hands down zero', async () => {
    actAs('SiteAdmin')
    const props = await handedDown()
    expect(getUnreadCount).not.toHaveBeenCalled()
    expect(props.unread.count).toBe(0)
  })
})

describe('GET /inbox/unread-count', () => {
  it('answers the reader’s count as JSON', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(12)
    const response = await unreadCountRoute()
    expect(await response.json()).toEqual({ unreadCount: 12 })
  })
})
