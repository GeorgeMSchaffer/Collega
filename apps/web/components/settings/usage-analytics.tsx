import { Alert, Badge, Card, CardContent, cn, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PageSize } from '@/components/list'
import type { UsageOverview, UsagePaths, UsageRole, UsageTrail } from '@/lib/data'
import {
  describeTrailItem,
  formatWait,
  MILESTONE_LABELS,
  usageEventLabel,
} from '@/lib/usage-report'
import { UsageTrailPager } from './usage-filters'

/**
 * The Site Admin usage screen's three tabs (`SPEC/20-feature-analytics.md` rule 19; comp
 * `comp-r-usage-analytics.html`, approved 2026-10-27). Server components: the page reads the API
 * and hands each tab its answer.
 */

const ROLES: readonly UsageRole[] = ['OrgAdmin', 'User', 'ReadOnly']
const fmt = (n: number) => n.toLocaleString('en-US')
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0)
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const stamp = (iso: string) => {
  const at = new Date(iso)
  const time = at.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  return `${shortDate(iso)} · ${time}`
}

export type UsageTab = 'overview' | 'paths' | 'trail'

export function UsageTabs({
  active,
  hrefFor,
}: {
  active: UsageTab
  hrefFor: (tab: UsageTab) => string
}) {
  const tabs: [UsageTab, string][] = [
    ['overview', 'Overview'],
    ['paths', 'Paths'],
    ['trail', 'Member trail'],
  ]
  return (
    <nav aria-label="Usage views" className="flex gap-0.5 border-b">
      {tabs.map(([tab, label]) => (
        <Link
          key={tab}
          href={hrefFor(tab) as Route}
          aria-current={tab === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-[3px] border-transparent px-3 py-1.5 text-sm text-secondary-foreground no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            tab === active && 'border-primary font-semibold text-foreground',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

function Panel({ title, lead, children }: { title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          <p className="m-0 text-sm text-muted-foreground">{lead}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function Foot({ children }: { children: ReactNode }) {
  return <p className="m-0 text-xs text-muted-foreground">{children}</p>
}

/** A count with a bar scaled to the column's largest, as the comp's `.bar`. */
function CountBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span
        aria-hidden="true"
        className="inline-block h-2 rounded-sm bg-primary"
        style={{ width: `${Math.max(2, Math.round((70 * value) / Math.max(1, max)))}px` }}
      />
      {fmt(value)}
    </span>
  )
}

const KIND: Record<
  'view' | 'change' | 'viewAs',
  { label: string; variant: 'secondary' | 'success' | 'warning' }
> = {
  view: { label: 'Viewed', variant: 'secondary' },
  change: { label: 'Changed', variant: 'success' },
  viewAs: { label: 'View As', variant: 'warning' },
}

function KindBadge({ kind }: { kind: keyof typeof KIND }) {
  return <Badge variant={KIND[kind].variant}>{KIND[kind].label}</Badge>
}

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2'
const num = 'text-right tabular-nums'

export function UsageOverviewTab({
  overview,
  periodLabel,
  tableView,
  viewToggleHref,
}: {
  overview: UsageOverview
  periodLabel: string
  tableView: boolean
  viewToggleHref: string
}) {
  const { totals, milestones, weeklyActive, featureUse, dailyOnly } = overview
  const stats: [string, string][] = dailyOnly
    ? [
        [fmt(totals.views), 'views'],
        [fmt(totals.changes), 'changes'],
      ]
    : [
        [
          `${fmt(totals.activeMembers)} of ${fmt(totals.members)}`,
          `members active, ${periodLabel.toLowerCase()}`,
        ],
        [fmt(totals.views), 'views'],
        [fmt(totals.changes), 'changes'],
        [totals.visitsPerActiveMemberPerWeek.toFixed(1), 'visits per active member per week'],
      ]
  const maxUse = Math.max(1, ...featureUse.map((row) => row.count))
  const peak = Math.max(1, ...weeklyActive.map((row) => row.activeMembers))

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([value, label]) => (
          <Card key={label}>
            <CardContent className="flex flex-col gap-0.5">
              <span className="text-2xl font-semibold tabular-nums">{value}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Getting started" lead="Milestones for this organization, from the audit log.">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {milestones.map((milestone) => {
              const reached = milestone.reachedAtUtc !== null
              return (
                <li
                  key={milestone.key}
                  className={cn(
                    'flex items-baseline gap-2 text-sm',
                    !reached && 'text-muted-foreground',
                  )}
                >
                  <span aria-hidden="true" className="w-4 text-center">
                    {reached ? '✓' : '·'}
                  </span>
                  <span className="flex-1">{MILESTONE_LABELS[milestone.key]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {milestone.reachedAtUtc === null
                      ? 'not yet'
                      : `${shortDate(milestone.reachedAtUtc)}${
                          milestone.key !== 'organizationCreated' &&
                          milestone.daysSinceCreated !== null
                            ? ` · after ${milestone.daysSinceCreated} ${milestone.daysSinceCreated === 1 ? 'day' : 'days'}`
                            : ''
                        }`}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel
          title="Members coming back"
          lead={`Share of ${fmt(totals.members)} members active each week since the organization started.`}
        >
          {weeklyActive.length === 0 ? (
            <Foot>No active weeks yet.</Foot>
          ) : (
            <>
              {weeklyActive.length < 3 ? (
                <Foot>
                  Only {weeklyActive.length} {weeklyActive.length === 1 ? 'week' : 'weeks'} so far.
                  A trend shows from week 3.
                </Foot>
              ) : null}
              {tableView ? (
                <Table
                  head={
                    <>
                      <th className={th}>Week of</th>
                      <th className={cn(th, num)}>Active members</th>
                      <th className={cn(th, num)}>Share</th>
                    </>
                  }
                >
                  {weeklyActive.map((row) => (
                    <tr key={row.week} className="border-b last:border-0">
                      <td className={td}>{shortDate(row.week)}</td>
                      <td className={cn(td, num)}>{row.activeMembers}</td>
                      <td className={cn(td, num)}>{pct(row.activeMembers, totals.members)}%</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <div
                  role="img"
                  aria-label="Active members by week since the organization started"
                  className="flex h-36 items-end gap-1"
                >
                  {weeklyActive.map((row) => (
                    <div
                      key={row.week}
                      title={`Week of ${shortDate(row.week)}: ${row.activeMembers} of ${totals.members} members (${pct(row.activeMembers, totals.members)}%)`}
                      className="flex min-w-0 max-w-12 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <small className="text-[10px] text-muted-foreground tabular-nums">
                        {pct(row.activeMembers, totals.members)}%
                      </small>
                      <span
                        className="w-full rounded-t-sm bg-primary"
                        style={{ height: `${Math.round((100 * row.activeMembers) / peak)}px` }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Foot>
                <Link href={viewToggleHref as Route}>
                  {tableView ? 'Show as chart' : 'Show as table'}
                </Link>
              </Foot>
            </>
          )}
        </Panel>
      </div>

      <Panel
        title="Feature use"
        lead={
          dailyOnly
            ? 'Views in the period, from daily counts.'
            : 'Views and changes in the period. People = distinct members.'
        }
      >
        {featureUse.length === 0 ? (
          <Foot>Nothing recorded in this period.</Foot>
        ) : (
          <Table
            head={
              <>
                <th className={th}>What</th>
                <th className={th}>Kind</th>
                <th className={th}>Count</th>
                {dailyOnly ? null : (
                  <>
                    <th className={cn(th, num)}>People</th>
                    <th className={cn(th, num)}>Org Admins</th>
                    <th className={cn(th, num)}>Users</th>
                    <th className={cn(th, num)}>Read Only</th>
                  </>
                )}
              </>
            }
          >
            {featureUse.map((row) => (
              <tr key={`${row.kind}:${row.event}`} className="border-b last:border-0">
                <td className={td}>{usageEventLabel(row.event)}</td>
                <td className={td}>
                  <KindBadge kind={row.kind} />
                </td>
                <td className={td}>
                  <CountBar value={row.count} max={maxUse} />
                </td>
                {dailyOnly ? null : (
                  <>
                    <td className={cn(td, num)}>{row.people ?? '—'}</td>
                    {ROLES.map((role) => (
                      <td key={role} className={cn(td, num)}>
                        {row.byRole?.[role] ?? '—'}
                      </td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </Table>
        )}
        <Foot>
          View As activity is not counted, nor are the views of members who turned off recording;
          their changes are.
          {dailyOnly ? ' Older than 90 days: counts per day only, no people or role split.' : ''}
        </Foot>
      </Panel>
    </>
  )
}

export function UsagePathsTab({
  paths,
  afterControl,
}: {
  paths: UsagePaths
  afterControl: ReactNode
}) {
  const max = Math.max(1, ...paths.items.map((row) => row.count))
  return (
    <Panel
      title="What people do next"
      lead={`The next step within the same visit, top 10. ${fmt(paths.total)} times in the period.`}
    >
      <div className="flex flex-wrap gap-3">{afterControl}</div>
      {paths.items.length === 0 ? (
        <Foot>Nothing to show for this starting point in the period.</Foot>
      ) : (
        <Table
          head={
            <>
              <th className={th}>Next step</th>
              <th className={th}>Times</th>
              <th className={cn(th, num)}>Share</th>
              <th className={cn(th, num)}>Typical wait</th>
            </>
          }
        >
          {paths.items.map((row) => (
            <tr key={row.next} className="border-b last:border-0">
              <td className={td}>{usageEventLabel(row.next)}</td>
              <td className={td}>
                <CountBar value={row.count} max={max} />
              </td>
              <td className={cn(td, num)}>{Math.round(100 * row.share)}%</td>
              <td className={cn(td, num)}>{formatWait(row.medianSecondsToNext)}</td>
            </tr>
          ))}
        </Table>
      )}
      <Foot>A visit ends after 30 minutes without activity. Typical wait is the median.</Foot>
    </Panel>
  )
}

export function UsageTrailTab({
  memberControl,
  member,
  trail,
  pageSize,
}: {
  memberControl: ReactNode
  member: { displayName: string; roleLabel: string } | null
  trail: UsageTrail | null
  pageSize: PageSize
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">{memberControl}</div>
        {member === null || trail === null ? (
          <EmptyState heading="Choose a member">
            The trail shows one member’s views and changes, for support.
          </EmptyState>
        ) : (
          <>
            <div>
              <h2 className="m-0 text-base font-semibold">{member.displayName}</h2>
              <p className="m-0 text-sm text-muted-foreground">
                {member.roleLabel} · views and changes, newest first. For support; only App Admins
                see this.
              </p>
            </div>
            {trail.optedOut ? (
              <Alert variant="note" role="note">
                {member.displayName} has turned off recording of feature use. Only changes from the
                audit log appear.
              </Alert>
            ) : null}
            {trail.items.length === 0 ? (
              <Foot>Nothing recorded for this member in the period.</Foot>
            ) : (
              <>
                <Table
                  head={
                    <>
                      <th className={th}>When (UTC)</th>
                      <th className={th}>Kind</th>
                      <th className={th}>What</th>
                    </>
                  }
                >
                  {trail.items.map((item) => (
                    <tr
                      key={`${item.occurredAtUtc}:${item.kind}:${item.event}:${item.entityId}`}
                      className={cn(
                        'border-b last:border-0',
                        item.kind === 'viewAs' && 'text-muted-foreground',
                      )}
                    >
                      <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                        {stamp(item.occurredAtUtc)}
                      </td>
                      <td className={td}>
                        <KindBadge kind={item.kind} />
                      </td>
                      <td className={td}>{describeTrailItem(item)}</td>
                    </tr>
                  ))}
                </Table>
                <UsageTrailPager page={trail.page} size={pageSize} total={trail.totalCount} />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
