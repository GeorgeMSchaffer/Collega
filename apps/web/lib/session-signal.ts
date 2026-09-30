/**
 * The browser-side signal that keeps every tab of one profile agreeing about the session
 * (`SPEC/20-feature-auth.md` requirement 39): activity in any tab resets the idle deadline in all
 * of them, and a session that ends in one tab ends in the others.
 *
 * `BroadcastChannel` where the browser has it; otherwise a `localStorage` write, whose `storage`
 * event reaches every other tab of the same origin. Both are scoped to the browser profile, which
 * is exactly the scope of the httpOnly cookie they are describing — so a signal never reaches a
 * tab that holds a different session.
 */

/**
 * Where the reader lands when the session ends, as the login page's notice flag: `expired` shows
 * "Your session expired", `passwordChanged` its own notice, `null` none (requirement 42).
 */
export type SessionEndNotice = 'expired' | 'passwordChanged' | null

export type SessionSignal =
  | { type: 'activity'; at: number }
  | { type: 'ended'; notice: SessionEndNotice }

const NAME = 'collega:session'

let channel: BroadcastChannel | null | undefined

function broadcastChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NAME)
  }
  return channel
}

export function publishSessionSignal(signal: SessionSignal): void {
  const open = broadcastChannel()
  if (open) {
    open.postMessage(signal)
    return
  }
  try {
    // Removed straight away: a `storage` event fires only when the value changes, so a signal left
    // behind would silence the next identical one — the same sign-out in a later session.
    localStorage.setItem(NAME, JSON.stringify(signal))
    localStorage.removeItem(NAME)
  } catch {
    // Storage blocked (a locked-down profile). The tab still enforces its own deadline.
  }
}

/** Listens for signals from the *other* tabs; neither transport echoes a tab's own. */
export function subscribeSessionSignal(listener: (signal: SessionSignal) => void): () => void {
  const open = broadcastChannel()
  if (open) {
    const onMessage = (event: MessageEvent<SessionSignal>) => listener(event.data)
    open.addEventListener('message', onMessage)
    return () => open.removeEventListener('message', onMessage)
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== NAME || !event.newValue) return
    try {
      listener(JSON.parse(event.newValue) as SessionSignal)
    } catch {
      // Not ours to interpret.
    }
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

/** The login page's address for a notice, so every tab lands where the first one did. */
export function loginHref(notice: SessionEndNotice): string {
  return notice ? `/login?${notice}=1` : '/login'
}
