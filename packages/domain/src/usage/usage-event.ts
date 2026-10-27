// What a usage event may carry (SPEC/20-feature-analytics.md rules 7-8; SPEC/contracts/usage.md).
// Anything outside these rules is dropped, never stored: the intake route answers 202 regardless.

export const USAGE_EVENT_TYPES = [
  'board.viewed',
  'idea.opened',
  'list.viewed',
  'search.run',
  'filter.applied',
  'admin.viewed',
  'settings.viewed',
] as const

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number]

/** The only `props` keys any event may send. Values are short text, a count, or a list of keys. */
const PROP_KEYS = new Set(['source', 'list', 'scope', 'resultCount', 'filterKeys', 'screen'])

export const MAX_EVENTS_PER_BATCH = 50
const MAX_TEXT = 100
const MAX_LIST = 20
const MAX_ROUTE = 200
/** A browser clock further than this from the server's is replaced by the server's time. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A route template: path segments and `[param]` placeholders only, so no resolved id or query. */
const ROUTE = /^(\/([a-z0-9-]+|\[[a-zA-Z]+\]))*\/?$/

export type UsageEvent = {
  readonly type: UsageEventType
  readonly route: string
  readonly entityId: string | null
  readonly props: Readonly<Record<string, string | number | readonly string[]>> | null
  readonly occurredAtUtc: Date
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT
}

function parseProps(value: unknown): UsageEvent['props'] | undefined {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const props: Record<string, string | number | readonly string[]> = {}
  for (const [key, item] of Object.entries(value)) {
    if (!PROP_KEYS.has(key)) {
      return undefined
    }
    if (isText(item) || (Number.isInteger(item) && (item as number) >= 0)) {
      props[key] = item as string | number
    } else if (Array.isArray(item) && item.length <= MAX_LIST && item.every(isText)) {
      props[key] = item as string[]
    } else {
      return undefined
    }
  }
  return Object.keys(props).length === 0 ? null : props
}

/** One event from the browser, or `null` when it breaks any rule. */
export function parseUsageEvent(raw: unknown, now: Date): UsageEvent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }
  const event = raw as Record<string, unknown>
  const type = USAGE_EVENT_TYPES.find((known) => known === event.type)
  const route = event.route
  if (
    type === undefined ||
    typeof route !== 'string' ||
    route.length === 0 ||
    route.length > MAX_ROUTE ||
    !ROUTE.test(route)
  ) {
    return null
  }
  const entityId = event.entityId ?? null
  if (entityId !== null && !(typeof entityId === 'string' && UUID.test(entityId))) {
    return null
  }
  const props = parseProps(event.props)
  if (props === undefined) {
    return null
  }
  const sent = typeof event.occurredAtUtc === 'string' ? new Date(event.occurredAtUtc) : null
  const occurredAtUtc =
    sent !== null &&
    !Number.isNaN(sent.getTime()) &&
    Math.abs(sent.getTime() - now.getTime()) <= MAX_CLOCK_SKEW_MS
      ? sent
      : now
  return { type, route, entityId: entityId?.toLowerCase() ?? null, props, occurredAtUtc }
}

/** The valid events of a batch body; an unusable body yields none. */
export function parseUsageBatch(body: unknown, now: Date): UsageEvent[] {
  const events = (body as { events?: unknown } | null)?.events
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS_PER_BATCH) {
    return []
  }
  return events.flatMap((raw) => {
    const event = parseUsageEvent(raw, now)
    return event === null ? [] : [event]
  })
}
