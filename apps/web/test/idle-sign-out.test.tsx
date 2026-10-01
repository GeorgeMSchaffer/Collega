import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, IdleSignOut } from '@/components/auth/idle-sign-out'
import type { SessionSignal } from '@/lib/session-signal'
import { stubDialogMethods } from './support/dialog'

/**
 * The browser idle deadline (`SPEC/20-feature-auth.md` requirements 38-42).
 *
 * Real timers are replaced and the component's own `clock` prop reads the same fake clock, so
 * thirty minutes pass in microseconds. The other tabs are simulated through a `BroadcastChannel`
 * stand-in that delivers a message to every *other* instance, as the browser does, so
 * `lib/session-signal.ts` is exercised for real rather than mocked.
 */

const signOut = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/auth-actions', () => ({ signOut }))

stubDialogMethods()

type Listener = (event: { data: SessionSignal }) => void
class FakeBroadcastChannel {
  static all: FakeBroadcastChannel[] = []
  listeners = new Set<Listener>()
  constructor(readonly name: string) {
    FakeBroadcastChannel.all.push(this)
  }
  postMessage(data: SessionSignal) {
    for (const other of FakeBroadcastChannel.all) {
      if (other === this || other.name !== this.name) continue
      for (const listener of other.listeners) listener({ data })
    }
  }
  addEventListener(_type: string, listener: Listener) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: string, listener: Listener) {
    this.listeners.delete(listener)
  }
}
vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)

/** A second tab of the same profile: it can speak, and the component under test hears it. */
let otherTab: FakeBroadcastChannel
/** What the component told the other tabs. */
let heard: SessionSignal[]

const START = Date.parse('2026-10-01T09:00:00Z')
const MIN = 60_000
const clock = { now: () => Date.now() }

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function mount(props: Partial<Parameters<typeof IdleSignOut>[0]> = {}) {
  const navigate = vi.fn()
  const view = render(<IdleSignOut clock={clock} navigate={navigate} {...props} />)
  return { navigate, ...view }
}

function warning() {
  return screen.queryByText('Your session is about to expire')
}

function activity() {
  act(() => {
    fireEvent.pointerDown(document.body)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  // The component's own channel is created once, lazily, and lives for the whole file; only this
  // tab's stand-in is made fresh.
  otherTab = new FakeBroadcastChannel('collega:session')
  heard = []
  otherTab.addEventListener('message', (event) => heard.push(event.data))
  signOut.mockReset()
})

afterEach(() => {
  FakeBroadcastChannel.all = FakeBroadcastChannel.all.filter((tab) => tab !== otherTab)
  vi.useRealTimers()
})

describe('IdleSignOut deadline', () => {
  it('does nothing while the reader is inside the first twenty-eight minutes', () => {
    const { navigate } = mount()
    advance(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000)
    expect(warning()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('sends the tab to the expired sign-in at exactly thirty minutes idle', () => {
    const { navigate } = mount()
    advance(IDLE_TIMEOUT_MS - 1000)
    expect(navigate).not.toHaveBeenCalled()
    advance(1000)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?expired=1')
  })

  it('navigates only once however long the page lingers afterwards', () => {
    const { navigate } = mount()
    advance(IDLE_TIMEOUT_MS + 10 * MIN)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('honours custom timing props', () => {
    const { navigate } = mount({ timeoutMs: 10_000, warningMs: 4000 })
    advance(5000)
    expect(warning()).toBeNull()
    advance(1000)
    expect(warning()).not.toBeNull()
    advance(4000)
    expect(navigate).toHaveBeenCalledWith('/login?expired=1')
  })

  it('stops watching once unmounted', () => {
    const { navigate, unmount } = mount()
    unmount()
    advance(IDLE_TIMEOUT_MS + MIN)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('IdleSignOut activity', () => {
  it.each(['pointerDown', 'keyDown', 'touchStart', 'wheel', 'scroll'] as const)(
    'counts a %s event as activity and pushes the deadline back',
    (kind) => {
      const { navigate } = mount()
      advance(20 * MIN)
      act(() => {
        fireEvent[kind](document.body)
      })
      advance(IDLE_TIMEOUT_MS - 1000)
      expect(navigate).not.toHaveBeenCalled()
      advance(1000)
      expect(navigate).toHaveBeenCalledWith('/login?expired=1')
    },
  )

  it('hears a scroll on a nested element, which does not bubble', () => {
    const { navigate } = mount()
    const inner = document.createElement('div')
    document.body.append(inner)
    advance(20 * MIN)
    act(() => {
      fireEvent.scroll(inner)
    })
    advance(20 * MIN)
    expect(navigate).not.toHaveBeenCalled()
    inner.remove()
  })

  it('counts the tab becoming visible, but not becoming hidden', () => {
    const { navigate } = mount()
    advance(20 * MIN)
    const state = vi.spyOn(document, 'visibilityState', 'get')
    state.mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    advance(10 * MIN)
    expect(navigate).toHaveBeenCalledWith('/login?expired=1')

    const second = mount()
    advance(20 * MIN)
    state.mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    advance(20 * MIN)
    expect(second.navigate).not.toHaveBeenCalled()
  })

  it('does not let activity revive a session whose deadline already passed unnoticed', () => {
    const { navigate } = mount()
    // A laptop lid closed for an hour: the clock moves, no interval tick has fired yet.
    vi.setSystemTime(START + 60 * MIN)
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?expired=1')
    state.mockRestore()
  })

  it('tells the other tabs about its own activity, at most once a second', () => {
    mount()
    expect(heard).toEqual([{ type: 'activity', at: START }])
    heard.length = 0
    advance(5000)
    activity()
    activity()
    activity()
    expect(heard).toEqual([{ type: 'activity', at: START + 5000 }])
    advance(1000)
    activity()
    expect(heard).toHaveLength(2)
  })
})

describe('IdleSignOut warning', () => {
  it('opens an alertdialog at minute twenty-eight showing two minutes', () => {
    mount()
    advance(28 * MIN - 1000)
    expect(warning()).toBeNull()
    advance(1000)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('You will be signed out in 2:00')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('counts down live, a second at a time, to the deadline', () => {
    mount()
    advance(28 * MIN)
    advance(1000)
    expect(screen.getByRole('alertdialog').textContent).toContain('signed out in 1:59')
    advance(59_000)
    expect(screen.getByRole('alertdialog').textContent).toContain('signed out in 1:00')
    advance(50_000)
    expect(screen.getByRole('alertdialog').textContent).toContain('signed out in 0:10')
  })

  it('rounds a partial second up, so the countdown never reads zero before the deadline', () => {
    mount()
    advance(500)
    activity() // the idle clock now runs half a second behind the one-second ticks
    advance(28 * MIN + 1000)
    expect(screen.getByRole('alertdialog').textContent).toContain('signed out in 2:00')
  })

  it('announces to screen readers every thirty seconds, not every second', () => {
    mount()
    advance(28 * MIN)
    const live = () => screen.getByRole('alertdialog').querySelector('[aria-live="polite"]')
    expect(live()?.textContent).toBe('Signing out in 2:00.')
    advance(1000)
    expect(live()?.textContent).toBe('Signing out in 2:00.')
    advance(30_000)
    expect(live()?.textContent).toBe('Signing out in 1:30.')
  })

  it('focuses Stay signed in when it opens and gives focus back when it closes', () => {
    render(<button type="button">behind</button>)
    const behind = screen.getByText('behind')
    behind.focus()
    mount()
    advance(28 * MIN)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay signed in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(document.activeElement).toBe(behind)
  })

  it('traps Tab between its two buttons', () => {
    mount()
    advance(28 * MIN)
    const signOutButton = screen.getByRole('button', { name: 'Sign out' })
    const stay = screen.getByRole('button', { name: 'Stay signed in' })
    stay.focus()
    // fireEvent returns false when the handler called preventDefault, which is what stops the
    // browser's own Tab moving focus out of the dialog as well.
    expect(fireEvent.keyDown(stay, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(signOutButton)
    expect(fireEvent.keyDown(signOutButton, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(stay)
  })

  it('leaves Tab alone between the two buttons', () => {
    mount()
    advance(28 * MIN)
    const signOutButton = screen.getByRole('button', { name: 'Sign out' })
    const stay = screen.getByRole('button', { name: 'Stay signed in' })
    signOutButton.focus()
    expect(fireEvent.keyDown(signOutButton, { key: 'Tab' })).toBe(true)
    stay.focus()
    expect(fireEvent.keyDown(stay, { key: 'Tab', shiftKey: true })).toBe(true)
  })

  it('opens as a modal dialog, so the page behind it cannot be reached', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    mount()
    expect(showModal).not.toHaveBeenCalled()
    advance(28 * MIN)
    expect(showModal).toHaveBeenCalledTimes(1)
  })

  it('cannot be cancelled by the browser', () => {
    mount()
    advance(28 * MIN)
    const cancel = new Event('cancel', { cancelable: true })
    screen.getByRole('alertdialog').dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
  })

  it('does not treat a press inside the warning as activity', () => {
    const { navigate } = mount()
    advance(28 * MIN)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Sign out' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Sign out' }), { key: 'x' })
    expect(warning()).not.toBeNull()
    advance(2 * MIN)
    expect(navigate).toHaveBeenCalledWith('/login?expired=1')
  })

  it('is dismissed by activity outside it', () => {
    mount()
    advance(28 * MIN)
    activity()
    expect(warning()).toBeNull()
  })
})

describe('IdleSignOut Stay signed in', () => {
  it('closes the warning and restarts the thirty minutes from now', () => {
    const { navigate } = mount()
    advance(29 * MIN)
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(warning()).toBeNull()
    advance(IDLE_TIMEOUT_MS - 1000)
    expect(navigate).not.toHaveBeenCalled()
    advance(1000)
    expect(navigate).toHaveBeenCalledWith('/login?expired=1')
  })

  it('touches neither the session nor the network, only the browser clock', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    mount()
    advance(28 * MIN)
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  })

  it('does not extend the absolute session limit', () => {
    const { navigate } = mount({ sessionRemainingMs: 29 * MIN + 30_000 })
    advance(28 * MIN)
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }))
    advance(MIN + 29_000)
    expect(navigate).not.toHaveBeenCalled()
    advance(1000)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?expired=1')
  })

  it('tells the other tabs straight away, ignoring the one-a-second throttle', () => {
    // Warning window as long as the timeout: the warning is open the moment the page mounts,
    // inside the second in which mounting already published.
    mount({ timeoutMs: 1500, warningMs: 1500 })
    expect(warning()).not.toBeNull()
    heard.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(heard).toEqual([{ type: 'activity', at: Date.now() }])
  })

  it('is what Escape does too', () => {
    const { navigate } = mount()
    advance(28 * MIN)
    const dialog = screen.getByRole('alertdialog')
    const notPrevented = fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(notPrevented).toBe(false) // preventDefault: the page underneath does not also react
    expect(warning()).toBeNull()
    advance(29 * MIN)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('IdleSignOut explicit sign-out', () => {
  it('runs the sign-out action and never routes to the expired notice', () => {
    const { navigate } = mount()
    advance(28 * MIN)
    const form = screen.getByRole('button', { name: 'Sign out' }).closest('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('IdleSignOut absolute expiry', () => {
  it('lands on the expired notice at the cookie deadline even for an active reader', () => {
    const { navigate } = mount({ sessionRemainingMs: 5 * MIN })
    for (let i = 0; i < 4; i++) {
      advance(MIN)
      activity()
    }
    expect(navigate).not.toHaveBeenCalled()
    advance(MIN)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?expired=1')
  })

  it('treats a token that has already lapsed as expired on mount', () => {
    const { navigate } = mount({ sessionRemainingMs: 0 })
    expect(navigate).toHaveBeenCalledWith('/login?expired=1')
  })

  it('has no absolute deadline when the remaining time is unknown', () => {
    const { navigate } = mount({ sessionRemainingMs: null })
    for (let i = 0; i < 20; i++) {
      advance(10 * MIN)
      activity()
    }
    expect(navigate).not.toHaveBeenCalled()
  })

  it('measures the remaining time on the browser clock, from mount', () => {
    const { navigate } = mount({ sessionRemainingMs: 3 * MIN })
    advance(3 * MIN - 1000)
    expect(navigate).not.toHaveBeenCalled()
    advance(1000)
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})

describe('IdleSignOut across tabs', () => {
  it('another tab being active postpones the deadline and dismisses the warning', () => {
    const { navigate } = mount()
    advance(28 * MIN)
    expect(warning()).not.toBeNull()
    act(() => otherTab.postMessage({ type: 'activity', at: Date.now() }))
    expect(warning()).toBeNull()
    advance(IDLE_TIMEOUT_MS - 1000)
    expect(navigate).not.toHaveBeenCalled()
    advance(1000)
    expect(navigate).toHaveBeenCalledWith('/login?expired=1')
  })

  it('ignores an activity signal older than what this tab already knows', () => {
    const { navigate } = mount()
    advance(10 * MIN)
    activity()
    act(() => otherTab.postMessage({ type: 'activity', at: START }))
    // The deadline is still thirty minutes after this tab's own activity at minute ten.
    advance(IDLE_TIMEOUT_MS - 1000)
    expect(navigate).not.toHaveBeenCalled()
    advance(1000)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['expired', '/login?expired=1'],
    ['passwordChanged', '/login?passwordChanged=1'],
    [null, '/login'],
  ] as const)('a session ended elsewhere with notice %s follows to %s', (notice, href) => {
    const { navigate } = mount()
    act(() => otherTab.postMessage({ type: 'ended', notice }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith(href)
  })

  it('does not follow an end signal after it has already ended itself', () => {
    const { navigate } = mount()
    advance(IDLE_TIMEOUT_MS)
    act(() => otherTab.postMessage({ type: 'ended', notice: null }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login?expired=1')
  })

  it('stops listening to other tabs once unmounted', () => {
    const { navigate, unmount } = mount()
    unmount()
    act(() => otherTab.postMessage({ type: 'ended', notice: 'expired' }))
    expect(navigate).not.toHaveBeenCalled()
  })
})
