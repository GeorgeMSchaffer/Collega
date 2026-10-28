// Satisfies `usage.UsageReports`: the Site Admin's overview, paths and member trail
// (SPEC/20-feature-analytics.md rule 19, SPEC/contracts/usage.md). Read only.
//
// "Statistics" exclude Site Admins, View As events and opted-out members' views, by the current
// role and opt-out of each user. Changes are audit events other than sign-ins and View As, and an
// audit row with no organization falls back to its actor's (`tools/analytics/journeys.sql`).

import type {
  UsageMilestoneKey,
  UsageOverview,
  UsagePaths,
  UsagePeriod,
  UsageReports,
  UsageRole,
  UsageTrailItem,
} from '@collega/application/usage'
import { Prisma, type PrismaClient } from '../persistence/prisma-client.js'

/** A visit ends after this long without an event (rule 19). */
const VISIT_GAP = Prisma.sql`INTERVAL '30 minutes'`
const WEEKS_SHOWN = 26
const PATHS_SHOWN = 10
const DAY_MS = 24 * 60 * 60 * 1000

/** The change events Feature use lists beside the view events (rule 19, "the main change events"). */
const MAIN_CHANGES = [
  'IdeaCreated',
  'IdeasImported',
  'IdeaUpdated',
  'IdeaStatusChanged',
  'IdeaUpvoteAdded',
  'CommentCreated',
  'BoardCreated',
  'BoardTaskCreated',
]

const MILESTONES: readonly UsageMilestoneKey[] = [
  'organizationCreated',
  'firstBoardByPerson',
  'firstIdea',
  'firstComment',
  'thirdActiveMember',
  'firstIdeaInFinalLane',
]

function roleFilter(role: UsageRole | null): Prisma.Sql {
  return role === null ? Prisma.empty : Prisma.sql`AND member.role::text = ${role}`
}

/** Counted views in a window: no View As, no Site Admin, no opted-out member. */
function views(organizationId: string, from: Date | null, to: Date | null, role: UsageRole | null) {
  return Prisma.sql`
    SELECT ue.user_id, member.role::text AS role, ue.event_type AS event, 'view' AS kind,
      ue.occurred_at_utc AS at
    FROM usage_events AS ue
    JOIN users AS member ON member.id = ue.user_id
    WHERE ue.organization_id = ${organizationId}::uuid
      ${from === null ? Prisma.empty : Prisma.sql`AND ue.occurred_at_utc >= ${from}::timestamptz`}
      ${to === null ? Prisma.empty : Prisma.sql`AND ue.occurred_at_utc < ${to}::timestamptz`}
      AND ue.on_behalf_of_user_id IS NULL
      AND member.role <> 'SiteAdmin'
      AND NOT member.usage_tracking_opt_out
      ${roleFilter(role)}
  `
}

/**
 * Counted changes in a window: audit events a member made themselves. Two branches rather than
 * `COALESCE(organization_id, actor's)`, so the organization index serves the first. `detail` adds
 * the entity id and metadata, for the milestones.
 */
function changes(
  organizationId: string,
  from: Date | null,
  to: Date | null,
  role: UsageRole | null,
  detail = false,
) {
  const branch = (organization: Prisma.Sql) => Prisma.sql`
    SELECT ae.actor_user_id AS user_id, member.role::text AS role, ae.event_type AS event,
      'change' AS kind, ae.occurred_at_utc AS at
      ${detail ? Prisma.sql`, ae.entity_id, ae.metadata_json` : Prisma.empty}
    FROM audit_events AS ae
    JOIN users AS member ON member.id = ae.actor_user_id
    WHERE ${organization}
      ${from === null ? Prisma.empty : Prisma.sql`AND ae.occurred_at_utc >= ${from}::timestamptz`}
      ${to === null ? Prisma.empty : Prisma.sql`AND ae.occurred_at_utc < ${to}::timestamptz`}
      AND ae.on_behalf_of_user_id IS NULL
      AND member.role <> 'SiteAdmin'
      AND ae.event_type NOT LIKE 'Auth%'
      AND ae.event_type NOT LIKE 'ViewAs%'
      ${roleFilter(role)}`
  return Prisma.sql`
    ${branch(Prisma.sql`ae.organization_id = ${organizationId}::uuid`)}
    UNION ALL
    ${branch(Prisma.sql`ae.organization_id IS NULL AND member.organization_id = ${organizationId}::uuid`)}
  `
}

function toNumber(value: bigint | number | string | null): number {
  return value === null ? 0 : Number(value)
}

export class PrismaUsageReportRepository implements UsageReports {
  constructor(private readonly prisma: PrismaClient) {}

  async organizationExists(organizationId: string): Promise<boolean> {
    const found = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    })
    return found !== null
  }

  async userOptedOut(userId: string): Promise<boolean | null> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { usage_tracking_opt_out: true },
    })
    return user === null ? null : user.usage_tracking_opt_out
  }

  async overview(period: UsagePeriod, dailyOnly: boolean): Promise<UsageOverview> {
    const { organizationId: org, fromUtc: from, toUtc: to, role } = period
    const weeks = (to.getTime() - from.getTime()) / (7 * DAY_MS)

    // Days already rolled up have no raw rows left, so daily counts and raw rows never overlap.
    const dailyViews = dailyOnly
      ? Prisma.sql`
          SELECT ud.event_type AS event, SUM(ud.event_count)::bigint AS count
          FROM usage_daily AS ud
          WHERE ud.organization_id = ${org}::uuid
            AND ud.day >= (${from}::timestamptz AT TIME ZONE 'UTC')::date
            AND ud.day < (${to}::timestamptz AT TIME ZONE 'UTC')::date
          GROUP BY ud.event_type`
      : Prisma.sql`SELECT NULL::text AS event, 0::bigint AS count WHERE false`

    const [[totals], milestones, weeklyActive, featureUse] = await Promise.all([
      this.prisma.$queryRaw<
        {
          members: bigint
          active_members: bigint
          views: bigint
          daily_views: bigint
          changes: bigint
          visits: bigint
        }[]
      >(Prisma.sql`
      WITH activity AS (${views(org, from, to, role)} UNION ALL ${changes(org, from, to, role)}),
      gaps AS (
        SELECT a.at - LAG(a.at) OVER (PARTITION BY a.user_id ORDER BY a.at) AS gap FROM activity AS a
      )
      SELECT
        (SELECT COUNT(*) FROM users AS member
          WHERE member.organization_id = ${org}::uuid AND member.status = 'Active'
            AND member.role <> 'SiteAdmin' ${roleFilter(role)}) AS members,
        (SELECT COUNT(DISTINCT a.user_id) FROM activity AS a) AS active_members,
        (SELECT COUNT(*) FROM activity AS a WHERE a.kind = 'view') AS views,
        (SELECT COALESCE(SUM(d.count), 0)::bigint FROM (${dailyViews}) AS d) AS daily_views,
        (SELECT COUNT(*) FROM activity AS a WHERE a.kind = 'change') AS changes,
        (SELECT COUNT(*) FROM gaps AS g WHERE g.gap IS NULL OR g.gap > ${VISIT_GAP}) AS visits
    `),
      this.milestones(org),
      this.weeklyActive(org, role),
      this.featureUse(period, dailyOnly, dailyViews),
    ])

    const activeMembers = toNumber(totals?.active_members ?? 0)
    const visits = toNumber(totals?.visits ?? 0)

    return {
      totals: {
        activeMembers,
        members: toNumber(totals?.members ?? 0),
        views: toNumber(totals?.views ?? 0) + toNumber(totals?.daily_views ?? 0),
        changes: toNumber(totals?.changes ?? 0),
        visitsPerActiveMemberPerWeek:
          activeMembers === 0 || weeks === 0
            ? 0
            : Math.round((10 * visits) / activeMembers / weeks) / 10,
      },
      milestones,
      weeklyActive,
      featureUse,
      dailyOnly,
    }
  }

  /** Whole history, not the period, and not narrowed by role. */
  private async milestones(org: string): Promise<UsageOverview['milestones']> {
    const [row] = await this.prisma.$queryRaw<Record<UsageMilestoneKey, Date | null>[]>(Prisma.sql`
      WITH contributing AS MATERIALIZED (${changes(org, null, null, null, true)}),
      default_board AS (
        SELECT (ae.metadata_json::jsonb ->> 'defaultBoardId')::uuid AS board_id
        FROM audit_events AS ae
        WHERE ae.organization_id = ${org}::uuid AND ae.event_type = 'OrganizationCreated'
      ),
      firsts AS (
        SELECT a.user_id, MIN(a.at) AS first_at
        FROM (
          SELECT c.user_id, c.at FROM contributing AS c
          UNION ALL
          SELECT v.user_id, v.at FROM (${views(org, null, null, null)}) AS v
        ) AS a
        GROUP BY a.user_id
      ),
      -- Filtered before the metadata is cast, so only status changes are read as JSON.
      status_moves AS MATERIALIZED (
        SELECT c.entity_id, c.at, c.metadata_json FROM contributing AS c
        WHERE c.event = 'IdeaStatusChanged'
      )
      SELECT
        org.created_at_utc AS "organizationCreated",
        (SELECT MIN(c.at) FROM contributing AS c
          WHERE c.event = 'BoardCreated'
            AND NOT EXISTS (SELECT 1 FROM default_board AS db WHERE db.board_id = c.entity_id)
        ) AS "firstBoardByPerson",
        (SELECT MIN(c.at) FROM contributing AS c
          WHERE c.event IN ('IdeaCreated', 'IdeasImported')) AS "firstIdea",
        (SELECT MIN(c.at) FROM contributing AS c WHERE c.event = 'CommentCreated') AS "firstComment",
        (SELECT f.first_at FROM firsts AS f ORDER BY f.first_at OFFSET 2 LIMIT 1) AS "thirdActiveMember",
        (SELECT MIN(m.at) FROM status_moves AS m
          JOIN ideas AS idea ON idea.id = m.entity_id
          JOIN board_swimlanes AS lane
            ON lane.board_id = idea.board_id
           AND lane.status_id = (m.metadata_json::jsonb ->> 'toStatusId')::uuid
           AND lane.is_final
        ) AS "firstIdeaInFinalLane"
      FROM organizations AS org
      WHERE org.id = ${org}::uuid
    `)
    const created = row?.organizationCreated ?? null
    return MILESTONES.map((key) => {
      const reachedAtUtc = row?.[key] ?? null
      return {
        key,
        reachedAtUtc,
        daysSinceCreated:
          reachedAtUtc === null || created === null
            ? null
            : Math.floor((reachedAtUtc.getTime() - created.getTime()) / DAY_MS),
      }
    })
  }

  /**
   * Weeks from the organization's first active week to this one, at most the last 26. Rolled-up
   * days name no one, so a week older than retention counts the members who made changes.
   */
  private async weeklyActive(
    org: string,
    role: UsageRole | null,
  ): Promise<UsageOverview['weeklyActive']> {
    const rows = await this.prisma.$queryRaw<{ week: Date; active_members: bigint }[]>(Prisma.sql`
      WITH activity AS (${views(org, null, null, role)} UNION ALL ${changes(org, null, null, role)}),
      bounds AS (
        SELECT MIN(a.at) AS first_at, GREATEST(
          date_trunc('week', MIN(a.at) AT TIME ZONE 'UTC'),
          date_trunc('week', now() AT TIME ZONE 'UTC') - ${WEEKS_SHOWN - 1} * INTERVAL '1 week'
        ) AS first_week
        FROM activity AS a
      )
      SELECT w.week, COUNT(DISTINCT a.user_id) AS active_members
      FROM bounds AS b
      CROSS JOIN LATERAL generate_series(
        b.first_week, date_trunc('week', now() AT TIME ZONE 'UTC'), INTERVAL '1 week'
      ) AS w (week)
      LEFT JOIN activity AS a
        ON date_trunc('week', a.at AT TIME ZONE 'UTC') = w.week
      WHERE b.first_at IS NOT NULL
      GROUP BY w.week
      ORDER BY w.week
    `)
    return rows.map((row) => ({
      week: row.week.toISOString().slice(0, 10),
      activeMembers: toNumber(row.active_members),
    }))
  }

  private async featureUse(
    period: UsagePeriod,
    dailyOnly: boolean,
    dailyViews: Prisma.Sql,
  ): Promise<UsageOverview['featureUse']> {
    const { organizationId: org, fromUtc: from, toUtc: to, role } = period
    if (dailyOnly) {
      // Views only, and no people: the daily counts do not say who (contract).
      const rows = await this.prisma.$queryRaw<{ event: string; count: bigint }[]>(Prisma.sql`
        SELECT t.event, SUM(t.count)::bigint AS count
        FROM (
          ${dailyViews}
          UNION ALL
          SELECT v.event, COUNT(*)::bigint FROM (${views(org, from, to, null)}) AS v GROUP BY v.event
        ) AS t
        GROUP BY t.event
        ORDER BY count DESC, t.event
      `)
      return rows.map((row) => ({
        event: row.event,
        kind: 'view' as const,
        count: toNumber(row.count),
        people: null,
        byRole: null,
      }))
    }
    const rows = await this.prisma.$queryRaw<
      {
        event: string
        kind: 'view' | 'change'
        count: bigint
        people: bigint
        org_admin: bigint
        user: bigint
        read_only: bigint
      }[]
    >(Prisma.sql`
      SELECT a.event, a.kind, COUNT(*) AS count, COUNT(DISTINCT a.user_id) AS people,
        COUNT(*) FILTER (WHERE a.role = 'OrgAdmin') AS org_admin,
        COUNT(*) FILTER (WHERE a.role = 'User') AS "user",
        COUNT(*) FILTER (WHERE a.role = 'ReadOnly') AS read_only
      FROM (
        ${views(org, from, to, role)}
        UNION ALL
        SELECT c.* FROM (${changes(org, from, to, role)}) AS c
        WHERE c.event IN (${Prisma.join(MAIN_CHANGES)})
      ) AS a
      GROUP BY a.event, a.kind
      ORDER BY a.kind DESC, count DESC, a.event
    `)
    return rows.map((row) => ({
      event: row.event,
      kind: row.kind,
      count: toNumber(row.count),
      people: toNumber(row.people),
      byRole: {
        OrgAdmin: toNumber(row.org_admin),
        User: toNumber(row.user),
        ReadOnly: toNumber(row.read_only),
      },
    }))
  }

  async paths(period: UsagePeriod, after: string): Promise<UsagePaths> {
    const { organizationId: org, fromUtc: from, toUtc: to, role } = period
    // Each event's successor in the same visit, or `left` when the visit ends there.
    const rows = await this.prisma.$queryRaw<
      { next: string; count: bigint; median_seconds: number | null }[]
    >(Prisma.sql`
      WITH activity AS (${views(org, from, to, role)} UNION ALL ${changes(org, from, to, role)}),
      ordered AS (
        SELECT a.event, a.at,
          LEAD(a.event) OVER (PARTITION BY a.user_id ORDER BY a.at, a.event) AS next_event,
          LEAD(a.at) OVER (PARTITION BY a.user_id ORDER BY a.at, a.event) AS next_at
        FROM activity AS a
      ),
      steps AS (
        SELECT
          CASE WHEN o.next_at IS NULL OR o.next_at - o.at > ${VISIT_GAP} THEN 'left' ELSE o.next_event END AS next,
          CASE WHEN o.next_at IS NULL OR o.next_at - o.at > ${VISIT_GAP} THEN NULL
            ELSE EXTRACT(EPOCH FROM o.next_at - o.at) END AS seconds
        FROM ordered AS o
        WHERE o.event = ${after}
      )
      SELECT s.next, COUNT(*) AS count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY s.seconds) AS median_seconds
      FROM steps AS s
      GROUP BY s.next
    `)
    const total = rows.reduce((sum, row) => sum + toNumber(row.count), 0)
    const toItem = (row: (typeof rows)[number]) => ({
      next: row.next,
      count: toNumber(row.count),
      share: total === 0 ? 0 : Math.round((1000 * toNumber(row.count)) / total) / 1000,
      medianSecondsToNext:
        row.next === 'left' || row.median_seconds === null ? null : Math.round(row.median_seconds),
    })
    const top = rows
      .filter((row) => row.next !== 'left')
      .sort((a, b) => toNumber(b.count) - toNumber(a.count) || a.next.localeCompare(b.next))
      .slice(0, PATHS_SHOWN)
      .map(toItem)
    const left = rows.filter((row) => row.next === 'left').map(toItem)
    return { total, items: [...top, ...left] }
  }

  async trail(query: {
    userId: string
    fromUtc: Date
    toUtc: Date
    includeViews: boolean
    offset: number
    limit: number
  }): Promise<{ items: readonly UsageTrailItem[]; totalCount: number }> {
    const { userId, fromUtc: from, toUtc: to } = query
    // A support record: an opted-out member's views are left out, and rows made while someone
    // acted as this member are `viewAs`.
    const inRange = (column: Prisma.Sql) =>
      Prisma.sql`${column} >= ${from}::timestamptz AND ${column} < ${to}::timestamptz`
    // One branch per way a row can belong to this member, so the member's own views use the
    // (user_id, occurred_at_utc) index. The other branches have no index on their user column and
    // range-scan by time, at most 90 days; indexing them needs a schema amendment.
    const viewBranch = (who: Prisma.Sql) => Prisma.sql`
      SELECT ue.occurred_at_utc AS at,
        CASE WHEN ue.on_behalf_of_user_id IS NULL THEN 'view' ELSE 'viewAs' END AS kind,
        ue.event_type AS event,
        CASE ue.event_type WHEN 'board.viewed' THEN 'Board' WHEN 'idea.opened' THEN 'Idea' END AS entity_type,
        ue.entity_id, ue.on_behalf_of_user_id, ue.user_id AS actor_user_id,
        ue.props_json AS metadata, ue.id
      FROM usage_events AS ue
      WHERE ${who} AND ${inRange(Prisma.sql`ue.occurred_at_utc`)}`
    // Changes as the statistics define them: no sign-in or View As bookkeeping.
    const changeBranch = (who: Prisma.Sql) => Prisma.sql`
      SELECT ae.occurred_at_utc AS at,
        CASE WHEN ae.on_behalf_of_user_id IS NULL THEN 'change' ELSE 'viewAs' END AS kind,
        ae.event_type AS event, ae.entity_type, ae.entity_id, ae.on_behalf_of_user_id,
        ae.actor_user_id, ae.metadata_json AS metadata, ae.id
      FROM audit_events AS ae
      WHERE ${who} AND ${inRange(Prisma.sql`ae.occurred_at_utc`)}
        AND ae.event_type NOT LIKE 'Auth%' AND ae.event_type NOT LIKE 'ViewAs%'`
    const viewRows = query.includeViews
      ? Prisma.sql`
          ${viewBranch(Prisma.sql`ue.user_id = ${userId}::uuid AND ue.on_behalf_of_user_id IS NULL`)}
          UNION ALL
          ${viewBranch(Prisma.sql`ue.on_behalf_of_user_id = ${userId}::uuid`)}
          UNION ALL`
      : Prisma.empty
    const trail = Prisma.sql`
      ${viewRows}
      ${changeBranch(Prisma.sql`ae.actor_user_id = ${userId}::uuid AND ae.on_behalf_of_user_id IS NULL`)}
      UNION ALL
      ${changeBranch(Prisma.sql`ae.on_behalf_of_user_id = ${userId}::uuid`)}
    `
    const [rows, [count]] = await Promise.all([
      this.prisma.$queryRaw<
        {
          at: Date
          kind: UsageTrailItem['kind']
          event: string
          entity_type: string | null
          entity_id: string | null
          on_behalf_of_user_id: string | null
          actor_user_id: string
          metadata: string | null
        }[]
      >(Prisma.sql`
        SELECT * FROM (${trail}) AS t
        ORDER BY t.at DESC, t.id DESC
        OFFSET ${query.offset} LIMIT ${query.limit}
      `),
      this.prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total FROM (${trail}) AS t`,
      ),
    ])
    return {
      items: rows.map((row) => ({
        occurredAtUtc: row.at,
        kind: row.kind,
        event: row.event,
        entityType: row.entity_type,
        entityId: row.entity_id,
        onBehalfOfUserId: row.on_behalf_of_user_id,
        actorUserId: row.actor_user_id,
        metadata: parseJson(row.metadata),
      })),
      totalCount: toNumber(count?.total ?? 0),
    }
  }
}

function parseJson(value: string | null): unknown {
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
