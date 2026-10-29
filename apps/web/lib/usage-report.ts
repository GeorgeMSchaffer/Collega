import type { UsageMilestoneKey, UsageRole, UsageTrailItem, UsageTrailNames } from './data/usage'

/**
 * What the Site Admin usage screen shows for the API's periods and event names (slice 367; comp
 * `SPEC/mockups/comp-r-usage-analytics.html`). Pure, so the screen and its tests read the same
 * wording.
 */

export const USAGE_RANGES = ['7', '30', '90', 'older'] as const
export type UsageRange = (typeof USAGE_RANGES)[number]

export const USAGE_RANGE_LABELS: Record<UsageRange, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  older: 'Older than 90 days (daily counts only)',
}

/** The spec's default retention (rule 16); raw-event routes refuse a `from` before it. */
const RETENTION_DAYS = 90
/** The older period is as long as the longest recent one (owner, 2026-10-28). */
const OLDER_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * `from` inclusive and `to` exclusive, as the contract reads them. "Last N days" ends tomorrow so
 * today is in it; "older" ends where retention starts, so it is wholly daily counts.
 */
export function usagePeriod(range: UsageRange, now: Date): { from: string; to: string } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (range === 'older') {
    const to = today - RETENTION_DAYS * DAY_MS
    return { from: ymd(to - OLDER_DAYS * DAY_MS), to: ymd(to) }
  }
  const days = Number(range)
  return { from: ymd(today - (days - 1) * DAY_MS), to: ymd(today + DAY_MS) }
}

export const USAGE_ROLE_LABELS: Record<UsageRole, string> = {
  OrgAdmin: 'Org Admins',
  User: 'Users',
  ReadOnly: 'Read Only',
}

export const MILESTONE_LABELS: Record<UsageMilestoneKey, string> = {
  organizationCreated: 'Organization created',
  firstBoardByPerson: 'First board made by a person',
  firstIdea: 'First idea',
  firstComment: 'First comment',
  thirdActiveMember: 'Third active member',
  firstIdeaInFinalLane: 'First idea moved to a final lane',
}

/** The view events Paths can start from, as the comp offers them. */
export const PATH_STARTS = ['idea.opened', 'board.viewed', 'search.run', 'list.viewed'] as const

const EVENT_LABELS: Record<string, string> = {
  'board.viewed': 'Board viewed',
  'idea.opened': 'Idea opened',
  'list.viewed': 'List viewed',
  'search.run': 'Search run',
  'filter.applied': 'Filter applied',
  'admin.viewed': 'Admin screen viewed',
  'settings.viewed': 'Settings viewed',
  left: 'Left (no further action this visit)',
}

/**
 * A view event's label, or an audit event type split into words: `IdeaStatusChanged` reads "Idea
 * status changed". The audit log has many types, and naming each here would drift from it.
 */
export function usageEventLabel(event: string): string {
  const known = EVENT_LABELS[event]
  if (known) return known
  const words = event.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "0:48", "1:52", "1:02:05"; `null` is a dash. */
export function formatWait(seconds: number | null): string {
  if (seconds === null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

type Props = Record<string, unknown>

const asProps = (metadata: unknown): Props =>
  metadata !== null && typeof metadata === 'object' ? (metadata as Props) : {}

const text = (value: unknown) => (typeof value === 'string' ? value : null)

/** The idea a trail row is about: the item itself, or a comment's idea (`{ Id }` in its audit metadata). */
export function trailIdeaId(item: UsageTrailItem): string | null {
  if (item.event === 'idea.opened' || item.entityType === 'Idea') return item.entityId
  if (item.entityType === 'Comment') return text(asProps(item.metadata).Id)
  return null
}

/**
 * One trail row in words, as the comp draws them: "Opened CI-19 “Bulk export…” from the board",
 * "Moved CI-19 from Review to Planned", "Sam Sitewide acting as Noah Contributor: viewed board
 * Customer Insights (not counted)". `names` comes from `getUsageTrailNames`; a name it could not
 * read falls back to the kind of thing ("an idea", "a board"), never an id.
 */
export function describeTrailItem(
  item: UsageTrailItem,
  names: UsageTrailNames,
  memberName: string,
): string {
  const props = asProps(item.metadata)
  const what = isView(item) ? describeView(item, props, names) : describeChange(item, props, names)
  if (item.kind !== 'viewAs') return what
  const actor = names.users[item.actorUserId] ?? 'An administrator'
  return `${actor} acting as ${memberName}: ${lowerFirst(what)} (not counted)`
}

/** View events are dotted (`board.viewed`); audit event types are not (`IdeaCreated`). */
const isView = (item: UsageTrailItem) => item.event.includes('.')

function ideaRef(item: UsageTrailItem, names: UsageTrailNames, withTitle = false): string {
  const id = trailIdeaId(item)
  const idea = id ? names.ideas[id] : undefined
  if (!idea) return 'an idea'
  if (!idea.itemKey) return `“${idea.title}”`
  return withTitle ? `${idea.itemKey} “${idea.title}”` : idea.itemKey
}

function boardRef(id: string | null, names: UsageTrailNames): string {
  const name = id ? names.boards[id] : undefined
  return name ? `board ${name}` : 'a board'
}

function describeView(item: UsageTrailItem, props: Props, names: UsageTrailNames): string {
  switch (item.event) {
    case 'board.viewed':
      return `Viewed ${boardRef(item.entityId, names)}`
    case 'idea.opened': {
      const source = text(props.source)
      return `Opened ${ideaRef(item, names, true)}${source ? ` from the ${source}` : ''}`
    }
    case 'list.viewed': {
      const list = text(props.list)
      return list ? `Viewed list ${capitalize(list)}` : 'Viewed a list'
    }
    case 'search.run': {
      const scope = text(props.scope)
      const count = typeof props.resultCount === 'number' ? props.resultCount : null
      const results = count === null ? '' : `${count} ${count === 1 ? 'result' : 'results'}, `
      return `Searched${scope ? ` ${scope}` : ''} (${results}no text kept)`
    }
    case 'filter.applied': {
      const keys = Array.isArray(props.filterKeys) ? props.filterKeys.filter(text) : []
      const list = text(props.list)
      return `Filtered${list ? ` list ${capitalize(list)}` : ''}${keys.length ? ` by ${keys.join(', ')}` : ''}`
    }
    case 'admin.viewed':
    case 'settings.viewed': {
      const screen = text(props.screen)
      return screen ? `Viewed ${screen}` : usageEventLabel(item.event)
    }
    default:
      return usageEventLabel(item.event)
  }
}

function describeChange(item: UsageTrailItem, props: Props, names: UsageTrailNames): string {
  switch (item.event) {
    case 'IdeaCreated':
      return `Created idea ${ideaRef(item, names)}`
    case 'IdeaUpdated':
      return `Edited ${ideaRef(item, names)}`
    case 'IdeaStatusChanged': {
      const from = names.statuses[text(props.fromStatusId) ?? '']
      const to = names.statuses[text(props.toStatusId) ?? '']
      return `Moved ${ideaRef(item, names)}${from ? ` from ${from}` : ''}${to ? ` to ${to}` : ''}`
    }
    case 'CommentCreated':
      return `Commented on ${ideaRef(item, names)}`
    case 'BoardCreated':
      return `Created ${boardRef(item.entityId, names)}`
  }
  const label = usageEventLabel(item.event)
  if (trailIdeaId(item)) return `${label}: ${ideaRef(item, names)}`
  if (item.entityType === 'Board') return `${label}: ${boardRef(item.entityId, names)}`
  return label
}

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1)
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
