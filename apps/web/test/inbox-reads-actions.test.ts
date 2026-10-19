import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toInboxItem } from '@/lib/api/adapt'
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api/client'
import type { WireNotification } from '@/lib/api/wire'
import { getInbox, getUnreadCount } from '@/lib/data/inbox'
import { setFollowing } from '@/lib/server/idea-actions'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/server/inbox-actions'

/**
 * The data seam and the writes behind following and the inbox (slices 153 and 154): which requests
 * the readers make and how a wire notification becomes a row (`boardName` included, null when the
 * API could not resolve one), and what the follow and mark-read actions post, revalidate and say
 * when refused. The HTTP client and the cache are the boundary; the clock is fixed.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const NOW = new Date('2026-10-01T12:00:00Z')

function wire(over: Partial<WireNotification> = {}): WireNotification {
  return {
    notificationId: 'n-1',
    eventType: 'CommentAdded',
    ideaId: 'i-1',
    ideaTitle: 'Slow conveyor',
    link: '/ideas/i-1',
    actor: {
      userId: 'u-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      displayName: 'Ada Lovelace',
      isActive: true,
    },
    statusName: null,
    boardName: 'Assembly',
    occurredAtUtc: '2026-10-01T11:30:00Z',
    readAtUtc: null,
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  for (const fn of [apiGet, apiPost, apiPut, apiDelete]) vi.mocked(fn).mockReset()
  revalidatePath.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toInboxItem', () => {
  it('carries the idea’s current board name onto the row', () => {
    expect(toInboxItem(wire({ boardName: 'Assembly' }), NOW).boardName).toBe('Assembly')
  })

  it('keeps a null board name null rather than inventing one', () => {
    expect(toInboxItem(wire({ boardName: null }), NOW).boardName).toBeNull()
  })

  it('is unread exactly when the API sent no read time', () => {
    expect(toInboxItem(wire({ readAtUtc: null }), NOW).unread).toBe(true)
    expect(toInboxItem(wire({ readAtUtc: '2026-10-01T11:45:00Z' }), NOW).unread).toBe(false)
  })

  it('words the time relative to the instant it is given', () => {
    expect(toInboxItem(wire(), NOW).when).toBe('30 min ago')
    expect(toInboxItem(wire({ occurredAtUtc: '2026-10-01T11:59:40Z' }), NOW).when).toBe('Just now')
  })

  it('reads the actor as a name and initials, and a missing actor as null', () => {
    expect(toInboxItem(wire(), NOW).actor).toEqual({ name: 'Ada Lovelace', initials: 'AL' })
    expect(toInboxItem(wire({ actor: null }), NOW).actor).toBeNull()
  })

  it('keeps the title the event was written with and the status it names', () => {
    const item = toInboxItem(wire({ eventType: 'IdeaStatusChanged', statusName: 'Review' }), NOW)
    expect(item).toMatchObject({
      id: 'n-1',
      ideaId: 'i-1',
      ideaTitle: 'Slow conveyor',
      eventType: 'IdeaStatusChanged',
      statusName: 'Review',
    })
  })
})

describe('getInbox', () => {
  const page = (items: WireNotification[]) => ({ items, page: 2, pageSize: 20, totalCount: 41 })

  it('asks for the requested page and size, and not for unread only by default', async () => {
    vi.mocked(apiGet).mockResolvedValue(page([]))
    await getInbox({ page: 2, pageSize: 20 })
    const [reader, path] = vi.mocked(apiGet).mock.calls[0] ?? []
    expect(reader).toBe('getInbox')
    expect(String(path)).toBe('/notifications?page=2&pageSize=20')
  })

  it('adds unread=true when asked for unread only', async () => {
    vi.mocked(apiGet).mockResolvedValue(page([]))
    await getInbox({ page: 1, pageSize: 5, unreadOnly: true })
    expect(String(vi.mocked(apiGet).mock.calls[0]?.[1])).toBe(
      '/notifications?page=1&pageSize=5&unread=true',
    )
  })

  it('returns the rows adapted against the current time, with the API’s paging', async () => {
    vi.mocked(apiGet).mockResolvedValue(page([wire(), wire({ notificationId: 'n-2' })]))
    const result = await getInbox({ page: 2, pageSize: 20 })
    expect(result.items.map((item) => item.id)).toEqual(['n-1', 'n-2'])
    expect(result.items[0]?.when).toBe('30 min ago')
    expect(result).toMatchObject({ page: 2, pageSize: 20, totalCount: 41 })
  })
})

describe('getUnreadCount', () => {
  it('returns the API’s uncapped count from the unread-count route', async () => {
    vi.mocked(apiGet).mockResolvedValue({ unreadCount: 137 })
    expect(await getUnreadCount()).toBe(137)
    expect(String(vi.mocked(apiGet).mock.calls[0]?.[1])).toBe('/notifications/unread-count')
  })
})

describe('markNotificationRead and markAllNotificationsRead', () => {
  it('post to the one notification’s read route, escaping its id', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined)
    expect(await markNotificationRead('a/b c')).toEqual({ error: null })
    expect(vi.mocked(apiPost).mock.calls[0]?.[0]).toBe('/notifications/a%2Fb%20c/read')
  })

  it('post to read-all for the whole inbox', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined)
    expect(await markAllNotificationsRead()).toEqual({ error: null })
    expect(vi.mocked(apiPost).mock.calls[0]?.[0]).toBe('/notifications/read-all')
  })

  it('revalidate the whole layout, because the sidebar badge is rendered there', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined)
    await markNotificationRead('n-1')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it.each([400, 403, 404, 409])('return the API’s message for a %i', async (status) => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(status, '/p', 'The API’s own words.'))
    expect(await markNotificationRead('n-1')).toEqual({ error: 'The API’s own words.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('send a 401 to the expired sign-in', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(401, '/p', 'No.'))
    await expect(markAllNotificationsRead()).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })

  it('let an unexpected failure through', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(500, '/p', 'boom'))
    await expect(markNotificationRead('n-1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('setFollowing', () => {
  it('follows with PUT on the idea’s follow route', async () => {
    vi.mocked(apiPut).mockResolvedValue(undefined)
    expect(await setFollowing('i-1', 'b-1', true)).toEqual({ error: null })
    expect(vi.mocked(apiPut).mock.calls[0]?.[0]).toBe('/ideas/i-1/follow')
    expect(apiDelete).not.toHaveBeenCalled()
  })

  it('unfollows with DELETE on the same route', async () => {
    vi.mocked(apiDelete).mockResolvedValue(undefined)
    expect(await setFollowing('i-1', 'b-1', false)).toEqual({ error: null })
    expect(vi.mocked(apiDelete).mock.calls[0]?.[0]).toBe('/ideas/i-1/follow')
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('revalidates the board, the idea lists and the inbox, whose drawer carries the same control', async () => {
    vi.mocked(apiPut).mockResolvedValue(undefined)
    await setFollowing('i-1', 'b-1', true)
    for (const path of [
      '/boards/b-1',
      '/ideas',
      '/delivery/sprint',
      '/delivery/backlog',
      '/inbox',
    ]) {
      expect(revalidatePath).toHaveBeenCalledWith(path)
    }
  })

  it('skips the board page for an idea on no board', async () => {
    vi.mocked(apiPut).mockResolvedValue(undefined)
    await setFollowing('i-1', '', true)
    expect(revalidatePath).not.toHaveBeenCalledWith('/boards/')
    expect(revalidatePath).toHaveBeenCalledWith('/inbox')
  })

  it('returns the API’s message and revalidates nothing when refused', async () => {
    vi.mocked(apiPut).mockRejectedValue(new ApiError(403, '/p', 'Follow through View As.'))
    expect(await setFollowing('i-1', 'b-1', true)).toEqual({ error: 'Follow through View As.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
