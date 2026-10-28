// The Site Admin's usage reads (SPEC/20-feature-analytics.md rule 19, SPEC/contracts/usage.md):
// overview, paths and the member trail. Site Admin acting directly only; the Org Admin view is a
// later contract change (rule 20).

import { Role } from '@collega/domain/enums'
import {
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  type Page,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type {
  UsageOverview,
  UsagePaths,
  UsagePeriod,
  UsageReports,
  UsageRole,
  UsageTrailItem,
} from './ports.js'

const DAY_MS = 24 * 60 * 60 * 1000
/** Routes that read raw events cover at most this many days (contract shared rules). */
const MAX_RAW_DAYS = 90
const TRAIL_DEFAULT_PAGE_SIZE = 50
const TRAIL_MAX_PAGE_SIZE = 100
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ROLES: readonly UsageRole[] = ['OrgAdmin', 'User', 'ReadOnly']
/** A view event type, or an audit event type such as `IdeaCreated`. */
const EVENT_NAME = /^[A-Za-z][A-Za-z.]{0,99}$/

type Query = Readonly<Record<string, unknown>>

export class UsageReportService {
  constructor(
    private readonly reports: UsageReports,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly retentionDays: number,
  ) {}

  /** `GET /usage/organizations/{organizationId}/overview`. */
  async overview(organizationId: string, query: Query): Promise<UsageOverview> {
    this.ensureSiteAdmin()
    const period = this.period(organizationId, query, false)
    const dailyOnly = period.fromUtc < this.retentionStart()
    if (dailyOnly && period.role !== null) {
      throw invalid('role', 'Older periods keep daily counts only, with no split by role.')
    }
    await this.ensureOrganization(organizationId)
    return this.reports.overview(period, dailyOnly)
  }

  /** `GET /usage/organizations/{organizationId}/paths`. */
  async paths(organizationId: string, query: Query): Promise<UsagePaths> {
    this.ensureSiteAdmin()
    const period = this.period(organizationId, query, true)
    const after = query.after
    if (typeof after !== 'string' || !EVENT_NAME.test(after)) {
      throw invalid('after', 'Choose the event the paths start from.')
    }
    await this.ensureOrganization(organizationId)
    return this.reports.paths(period, after)
  }

  /** `GET /usage/users/{userId}/trail`. */
  async trail(
    userId: string,
    query: Query,
  ): Promise<Page<UsageTrailItem> & { readonly optedOut: boolean }> {
    this.ensureSiteAdmin()
    const { fromUtc, toUtc } = this.period(userId, query, true)
    const page = wholeNumber(query.page, 1, 'page', 1, Number.MAX_SAFE_INTEGER)
    const pageSize = wholeNumber(
      query.pageSize,
      TRAIL_DEFAULT_PAGE_SIZE,
      'pageSize',
      1,
      TRAIL_MAX_PAGE_SIZE,
    )
    const optedOut = await this.reports.userOptedOut(userId)
    if (optedOut === null) {
      throw new NotFoundError('That user does not exist.')
    }
    const { items, totalCount } = await this.reports.trail({
      userId,
      fromUtc,
      toUtc,
      includeViews: !optedOut,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    })
    return { items, page, pageSize, totalCount, optedOut }
  }

  private ensureSiteAdmin(): void {
    if (this.currentUser.userId === null) {
      throw new UnauthorizedError('Sign in to see usage.')
    }
    if (this.currentUser.role !== Role.SiteAdmin || this.currentUser.isImpersonating) {
      throw new ForbiddenError('Only a Site Admin can see usage.')
    }
  }

  private async ensureOrganization(organizationId: string): Promise<void> {
    if (!(await this.reports.organizationExists(organizationId))) {
      throw new NotFoundError('That organization does not exist.')
    }
  }

  /** Midnight UTC, `retentionDays` before today: raw events are kept from here on. */
  private retentionStart(): Date {
    const now = this.clock.now()
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return new Date(today - this.retentionDays * DAY_MS)
  }

  private period(organizationId: string, query: Query, raw: boolean): UsagePeriod {
    const fromUtc = date(query.from, 'from')
    const toUtc = date(query.to, 'to')
    if (toUtc <= fromUtc) {
      throw invalid('to', 'To must be after from.')
    }
    if (raw) {
      if (fromUtc < this.retentionStart()) {
        throw invalid(
          'from',
          `Older periods keep daily counts only. Choose one within the last ${this.retentionDays} days.`,
        )
      }
      if (toUtc.getTime() - fromUtc.getTime() > MAX_RAW_DAYS * DAY_MS) {
        throw invalid('to', `A period covers at most ${MAX_RAW_DAYS} days.`)
      }
    }
    const role = query.role
    if (role !== undefined && !ROLES.includes(role as UsageRole)) {
      throw invalid('role', 'Role must be OrgAdmin, User or ReadOnly.')
    }
    return { organizationId, fromUtc, toUtc, role: (role as UsageRole | undefined) ?? null }
  }
}

function invalid(field: string, message: string): ValidationError {
  return new ValidationError('One or more fields are invalid.', { [field]: [message] })
}

function date(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !DATE.test(value)) {
    throw invalid(field, `${field === 'from' ? 'From' : 'To'} must be a date, YYYY-MM-DD.`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw invalid(field, `${field === 'from' ? 'From' : 'To'} must be a real date.`)
  }
  return parsed
}

function wholeNumber(
  value: unknown,
  fallback: number,
  field: string,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw invalid(
      field,
      field === 'page'
        ? 'Page must be a whole number, 1 or more.'
        : `Page size must be a whole number from ${min} to ${max}.`,
    )
  }
  return parsed
}
