/**
 * The browser's usage-event queue (`SPEC/20-feature-analytics.md` Part 3, rules 7-9 and 13).
 *
 * Memory only: never a cookie or browser storage, so a reload loses what was queued and that is
 * fine. Nothing here is awaited and nothing here throws: a failed send is dropped, not retried, and
 * the reader never sees it.
 */

export type UsageEventType =
  | 'board.viewed'
  | 'idea.opened'
  | 'list.viewed'
  | 'search.run'
  | 'filter.applied'
  | 'admin.viewed'
  | 'settings.viewed'

export type UsageProps = Readonly<Record<string, string | number | readonly string[]>>

/** What a screen records. Identity is never part of it: the server takes that from the session. */
export type UsageInput = {
  type: UsageEventType
  entityId?: string | null
  props?: UsageProps | null
}

/** One event as `POST /usage/events` takes it (`SPEC/contracts/usage.md`). */
export type UsageEvent = {
  type: UsageEventType
  route: string
  entityId: string | null
  props: UsageProps | null
  occurredAtUtc: string
}

/** The same event for the same item within this window is recorded once (rule 9). */
export const REPEAT_WINDOW_MS = 30_000
/** A batch goes as soon as the queue holds this many (rule 13). */
export const BATCH_SIZE = 25
/** Above this the oldest queued events are dropped (rule 13). */
export const MAX_QUEUED = 200

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The route template of a path: every id becomes `[id]`, so no event names an item by its URL. */
export function pathTemplate(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (GUID.test(segment) ? '[id]' : segment))
    .join('/')
}

type Options = {
  /** Hands one batch to the network. Must not throw; its result is ignored. */
  send: (events: UsageEvent[]) => void
  /** The current path, read when an event is recorded. */
  pathname: () => string
  now?: () => number
}

export type UsageQueue = {
  record: (input: UsageInput) => void
  /** Sends everything queued, in batches of at most `BATCH_SIZE`. */
  flush: () => void
  /** Drops everything queued without sending it. */
  clear: () => void
  /** While false, events queue but nothing is sent, not even at `BATCH_SIZE`. */
  setSending: (sending: boolean) => void
  size: () => number
}

function repeatKey(input: UsageInput): string {
  return JSON.stringify([input.type, input.entityId ?? null, input.props ?? null])
}

export function createUsageQueue({ send, pathname, now = Date.now }: Options): UsageQueue {
  let queued: UsageEvent[] = []
  const lastSeen = new Map<string, number>()
  let sending = false

  function flush(): void {
    if (!sending) return
    while (queued.length > 0) {
      const batch = queued.slice(0, BATCH_SIZE)
      queued = queued.slice(BATCH_SIZE)
      try {
        send(batch)
      } catch {
        // Usage never decides an outcome: a send that fails is dropped.
      }
    }
  }

  return {
    record(input) {
      const at = now()
      for (const [key, seen] of lastSeen) {
        if (at - seen >= REPEAT_WINDOW_MS) lastSeen.delete(key)
      }
      const key = repeatKey(input)
      if (lastSeen.has(key)) return
      lastSeen.set(key, at)

      queued.push({
        type: input.type,
        route: pathTemplate(pathname()),
        entityId: input.entityId ?? null,
        props: input.props ?? null,
        occurredAtUtc: new Date(at).toISOString(),
      })
      if (queued.length > MAX_QUEUED) queued = queued.slice(queued.length - MAX_QUEUED)
      if (queued.length >= BATCH_SIZE) flush()
    },
    flush,
    clear() {
      queued = []
    },
    setSending(value) {
      sending = value
    },
    size: () => queued.length,
  }
}
