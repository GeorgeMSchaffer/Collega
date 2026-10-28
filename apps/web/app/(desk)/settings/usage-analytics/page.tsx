import { EmptyState } from '@collega/design-system'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize } from '@/components/list'
import { SettingsPage } from '@/components/settings/settings-page'
import {
  UsageOverviewTab,
  UsagePathsTab,
  type UsageTab,
  UsageTabs,
  UsageTrailTab,
} from '@/components/settings/usage-analytics'
import { UsageSelect } from '@/components/settings/usage-filters'
import {
  getMembersForOrganization,
  getOrganizations,
  getUsageOverview,
  getUsagePaths,
  getUsageTrail,
  type UsageRole,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'
import {
  PATH_STARTS,
  USAGE_RANGE_LABELS,
  USAGE_RANGES,
  USAGE_ROLE_LABELS,
  type UsageRange,
  usageEventLabel,
  usagePeriod,
} from '@/lib/usage-report'

export const metadata = { title: 'Usage analytics · Collega' }

type Search = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T) =>
  allowed.includes(value as T) ? (value as T) : fallback

const TABS: readonly UsageTab[] = ['overview', 'paths', 'trail']
const ROLES = Object.keys(USAGE_ROLE_LABELS) as UsageRole[]

/**
 * Settings → Usage analytics (`/settings/usage-analytics`): how one organization uses Collega, for
 * a Site Admin acting directly (`SPEC/20-feature-analytics.md` rule 19; slice 367). Every filter is
 * in the URL. The Org Admin view (rule 20) is a later slice.
 */
export default async function UsageAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()
  const search = await searchParams
  // Under View As the API refuses these reads, and the gate below refuses the screen.
  const allowed = currentUser().role === 'SiteAdmin'

  return (
    <SettingsPage
      title="Usage analytics"
      gate="usage analytics"
      siteAdminOnly
      lead="How each organization uses Collega. One organization at a time; nothing is pooled across organizations."
    >
      {allowed ? <UsageAnalytics search={search} /> : null}
    </SettingsPage>
  )
}

async function UsageAnalytics({ search }: { search: Search }) {
  const organizations = await getOrganizations()
  const organizationId = organizations.find((org) => org.id === first(search.org))?.id ?? ''
  const range = oneOf<UsageRange>(first(search.period), USAGE_RANGES, '30')
  const older = range === 'older'
  // Older periods keep daily counts only, with no split by role: the API refuses one (400).
  const role = older ? null : (ROLES.find((r) => r === first(search.role)) ?? null)
  const tab = oneOf(first(search.tab), TABS, 'overview')
  const period = { ...usagePeriod(range, new Date()), role }

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
      const v = first(value)
      if (v !== undefined) next.set(key, v)
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    return `/settings/usage-analytics?${next.toString()}`
  }

  const filters = (
    <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0">
      <legend className="sr-only">Filters</legend>
      <UsageSelect
        name="org"
        label="Organization"
        value={organizationId}
        placeholder="Choose an organization"
        options={organizations.map((org) => ({ value: org.id, label: org.name }))}
      />
      <UsageSelect
        name="period"
        label="Period"
        value={range}
        options={USAGE_RANGES.map((value) => ({ value, label: USAGE_RANGE_LABELS[value] }))}
      />
      {older ? null : (
        <UsageSelect
          name="role"
          label="Role"
          value={role ?? ''}
          placeholder="All roles"
          options={ROLES.map((value) => ({ value, label: USAGE_ROLE_LABELS[value] }))}
        />
      )}
    </fieldset>
  )

  if (!organizationId) {
    return (
      <>
        {filters}
        <EmptyState heading="Choose an organization">
          Usage is shown one organization at a time.
        </EmptyState>
      </>
    )
  }

  return (
    <>
      {filters}
      <UsageTabs
        active={tab}
        hrefFor={(next) => hrefWith({ tab: next, page: null, pageSize: null })}
      />
      {tab === 'overview' ? (
        <UsageOverviewTab
          overview={await getUsageOverview(organizationId, period)}
          periodLabel={USAGE_RANGE_LABELS[range]}
          tableView={first(search.view) === 'table'}
          viewToggleHref={hrefWith({ view: first(search.view) === 'table' ? null : 'table' })}
        />
      ) : older ? (
        <EmptyState
          heading={
            tab === 'paths'
              ? 'Paths need the last 90 days'
              : 'The member trail covers the last 90 days'
          }
        >
          {tab === 'paths'
            ? 'Older periods keep daily counts only. Choose a period within the last 90 days.'
            : 'Older views are not kept. Changes stay in the audit log.'}
        </EmptyState>
      ) : tab === 'paths' ? (
        <PathsTab organizationId={organizationId} period={period} search={search} />
      ) : (
        <TrailTab organizationId={organizationId} period={period} search={search} />
      )}
    </>
  )
}

async function PathsTab({
  organizationId,
  period,
  search,
}: {
  organizationId: string
  period: { from: string; to: string; role: UsageRole | null }
  search: Search
}) {
  const after = oneOf(first(search.after), PATH_STARTS, 'idea.opened')
  return (
    <UsagePathsTab
      paths={await getUsagePaths(organizationId, period, after)}
      afterControl={
        <UsageSelect
          name="after"
          label="After"
          value={after}
          options={PATH_STARTS.map((value) => ({ value, label: usageEventLabel(value) }))}
        />
      }
    />
  )
}

async function TrailTab({
  organizationId,
  period,
  search,
}: {
  organizationId: string
  period: { from: string; to: string }
  search: Search
}) {
  const members = await getMembersForOrganization(organizationId)
  const member = members.find((m) => m.id === first(search.member)) ?? null
  const page = Math.max(1, Math.trunc(Number(first(search.page))) || 1)
  const pageSize = oneOf<`${PageSize}`>(
    first(search.pageSize),
    PAGE_SIZES.map(String) as `${PageSize}`[],
    `${DEFAULT_PAGE_SIZE}` as `${PageSize}`,
  )
  const size = Number(pageSize) as PageSize
  const trail = member ? await getUsageTrail(member.id, period, page, size) : null

  return (
    <UsageTrailTab
      member={member}
      trail={trail}
      pageSize={size}
      memberControl={
        <UsageSelect
          name="member"
          label="Member"
          value={member?.id ?? ''}
          placeholder="Choose a member"
          options={members.map((m) => ({
            value: m.id,
            label: `${m.displayName} · ${m.roleLabel}`,
          }))}
        />
      }
    />
  )
}
