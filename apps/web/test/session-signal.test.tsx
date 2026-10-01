import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionSignal } from '@/lib/session-signal'

/**
 * `lib/session-signal.ts` and its two ends: the login page's `SessionEndedSignal` and the tab that
 * listens (`SPEC/20-feature-auth.md` requirements 39, 41, 42).
 *
 * The module caches its `BroadcastChannel`, so each test loads a fresh copy after choosing which
 * transport the "browser" has.
 */

vi.mock('@/lib/server/auth-actions', () => ({ signOut: vi.fn() }))

type Handler = (event: MessageEvent<SessionSignal>) => void
class FakeChannel {
  static sent: { name: string; data: unknown }[] = []
  static instances: FakeChannel[] = []
  listeners = new Set<Handler>()
  constructor(readonly name: string) {
    FakeChannel.instances.push(this)
  }
  postMessage(data: unknown) {
    FakeChannel.sent.push({ name: this.name, data })
  }
  addEventListener(_type: string, listener: Handler) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: string, listener: Handler) {
    this.listeners.delete(listener)
  }
}

async function load(transport: 'broadcast' | 'storage') {
  vi.resetModules()
  FakeChannel.sent = []
  FakeChannel.instances = []
  vi.stubGlobal('BroadcastChannel', transport === 'broadcast' ? FakeChannel : undefined)
  const lib = await import('@/lib/session-signal')
  const { IdleSignOut } = await import('@/components/auth/idle-sign-out')
  const { SessionEndedSignal } = await import('@/components/auth/session-ended-signal')
  return { ...lib, IdleSignOut, SessionEndedSignal }
}

function storageEvent(init: StorageEventInit) {
  window.dispatchEvent(new StorageEvent('storage', init))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loginHref', () => {
  it('names the notice the login page reads', async () => {
    const { loginHref } = await load('broadcast')
    expect(loginHref('expired')).toBe('/login?expired=1')
    expect(loginHref('passwordChanged')).toBe('/login?passwordChanged=1')
  })

  it('is the bare sign-in form for an explicit sign-out', async () => {
    const { loginHref } = await load('broadcast')
    expect(loginHref(null)).toBe('/login')
  })
})

describe('BroadcastChannel transport', () => {
  it('posts each signal on one shared named channel and leaves localStorage alone', async () => {
    const { publishSessionSignal } = await load('broadcast')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    publishSessionSignal({ type: 'activity', at: 5 })
    publishSessionSignal({ type: 'ended', notice: 'expired' })
    expect(FakeChannel.instances).toHaveLength(1)
    expect(FakeChannel.sent).toEqual([
      { name: 'collega:session', data: { type: 'activity', at: 5 } },
      { name: 'collega:session', data: { type: 'ended', notice: 'expired' } },
    ])
    expect(setItem).not.toHaveBeenCalled()
  })

  it('hands a subscriber the data of each message, until it unsubscribes', async () => {
    const { subscribeSessionSignal } = await load('broadcast')
    const listener = vi.fn()
    const unsubscribe = subscribeSessionSignal(listener)
    const channel = FakeChannel.instances[0] as FakeChannel
    for (const handler of channel.listeners) {
      handler({ data: { type: 'ended', notice: null } } as MessageEvent<SessionSignal>)
    }
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'ended', notice: null })
    unsubscribe()
    expect(channel.listeners.size).toBe(0)
  })
})

describe('localStorage fallback transport', () => {
  it('writes the signal and removes it again, so the same signal can fire twice', async () => {
    const { publishSessionSignal } = await load('storage')
    const written: string[] = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      written.push(`${key}=${value}`)
    })
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    publishSessionSignal({ type: 'ended', notice: 'passwordChanged' })
    expect(written).toEqual(['collega:session={"type":"ended","notice":"passwordChanged"}'])
    expect(remove).toHaveBeenCalledWith('collega:session')
  })

  it('leaves nothing behind in storage', async () => {
    const { publishSessionSignal } = await load('storage')
    publishSessionSignal({ type: 'activity', at: 1 })
    expect(localStorage.getItem('collega:session')).toBeNull()
  })

  it('swallows a blocked storage rather than throwing into the page', async () => {
    const { publishSessionSignal } = await load('storage')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(() => publishSessionSignal({ type: 'activity', at: 1 })).not.toThrow()
  })

  it('delivers another tab’s storage event to the subscriber', async () => {
    const { subscribeSessionSignal } = await load('storage')
    const listener = vi.fn()
    subscribeSessionSignal(listener)
    storageEvent({ key: 'collega:session', newValue: '{"type":"activity","at":42}' })
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'activity', at: 42 })
  })

  it('ignores other keys, the removal event, and unparseable values', async () => {
    const { subscribeSessionSignal } = await load('storage')
    const listener = vi.fn()
    subscribeSessionSignal(listener)
    storageEvent({ key: 'something-else', newValue: '{"type":"ended","notice":null}' })
    storageEvent({ key: 'collega:session', newValue: null })
    storageEvent({ key: 'collega:session', newValue: '{not json' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops listening once unsubscribed', async () => {
    const { subscribeSessionSignal } = await load('storage')
    const listener = vi.fn()
    subscribeSessionSignal(listener)()
    storageEvent({ key: 'collega:session', newValue: '{"type":"ended","notice":null}' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('carries a sign-out written by one tab to the idle watcher of another', async () => {
    const { IdleSignOut } = await load('storage')
    const navigate = vi.fn()
    render(<IdleSignOut navigate={navigate} />)
    act(() => {
      storageEvent({ key: 'collega:session', newValue: '{"type":"ended","notice":"expired"}' })
    })
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?expired=1')
  })

  it('carries another tab’s activity to the idle watcher, which keeps its deadline moving', async () => {
    vi.useFakeTimers()
    try {
      const { IdleSignOut } = await load('storage')
      const navigate = vi.fn()
      render(<IdleSignOut navigate={navigate} />)
      act(() => vi.advanceTimersByTime(20 * 60_000))
      act(() => {
        storageEvent({
          key: 'collega:session',
          newValue: JSON.stringify({ type: 'activity', at: Date.now() }),
        })
      })
      act(() => vi.advanceTimersByTime(20 * 60_000))
      expect(navigate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('SessionEndedSignal', () => {
  it.each([['expired'], ['passwordChanged'], [null]] as const)(
    'tells the other tabs the session ended with notice %s',
    async (notice) => {
      const { SessionEndedSignal } = await load('broadcast')
      render(<SessionEndedSignal notice={notice} />)
      expect(FakeChannel.sent).toEqual([
        { name: 'collega:session', data: { type: 'ended', notice } },
      ])
    },
  )

  it('renders nothing', async () => {
    const { SessionEndedSignal } = await load('broadcast')
    const { container } = render(<SessionEndedSignal notice="expired" />)
    expect(container.innerHTML).toBe('')
  })
})
