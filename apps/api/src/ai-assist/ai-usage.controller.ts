import type { AiUsageReport, AiUsageSummary } from '@collega/application/ai'
import { AiUsageService } from '@collega/application/ai'
import { Role } from '@collega/domain/enums'
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { Roles } from '../auth/roles.decorator.js'
import { RolesGuard } from '../auth/roles.guard.js'
import { optional } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/**
 * The wire shape of a usage report. `AiUsageReport` carries the window, the rows and the ceiling,
 * and the totals are composed here rather than held on it - a sum of rows the report already has is
 * derived state the Application model would then have to keep consistent.
 *
 * The frozen app serialized three flat properties and no per-token breakdown. This returns the
 * `totals` object `SPEC/30-Contracts.md` specifies, which is a deliberate difference and an accepted
 * corpus one (`SPEC/decisions.md` 2026-09-13).
 *
 * `dailyTokenLimit` and `tokensUsedToday` are null on the single-organization report: the ceiling
 * is platform-wide and is not an organization's business.
 */
/**
 * `totals` carries the same six numeric fields as an organization entry, summed across them -
 * `SPEC/30-Contracts.md`, and a deliberate difference from the frozen app, which returned three
 * flat fields (`totalCalls`, `totalTokens`, `totalEstimatedCost`) and no per-token breakdown.
 *
 * The corpus records the flat shape, so the replay reports this as a difference. It is an accepted
 * one: `SPEC/decisions.md` 2026-09-13. Summing here rather than in the application layer keeps the
 * shape a presentation concern, which is what it is - `AiUsageReport` already carries every addend.
 */
type AiUsageTotals = {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  estimatedCost: number
}

type AiUsageResponse = {
  fromUtc: Date
  toUtc: Date
  organizations: readonly AiUsageSummary[]
  dailyTokenLimit: number | null
  tokensUsedToday: number | null
  totals: AiUsageTotals
}

function sumTotals(organizations: readonly AiUsageSummary[]): AiUsageTotals {
  return organizations.reduce<AiUsageTotals>(
    (totals, o) => ({
      calls: totals.calls + o.calls,
      inputTokens: totals.inputTokens + o.inputTokens,
      outputTokens: totals.outputTokens + o.outputTokens,
      cacheReadInputTokens: totals.cacheReadInputTokens + o.cacheReadInputTokens,
      cacheCreationInputTokens: totals.cacheCreationInputTokens + o.cacheCreationInputTokens,
      estimatedCost: totals.estimatedCost + o.estimatedCost,
    }),
    {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      estimatedCost: 0,
    },
  )
}

function toResponse(report: AiUsageReport): AiUsageResponse {
  return {
    fromUtc: report.fromUtc,
    toUtc: report.toUtc,
    organizations: report.organizations,
    dailyTokenLimit: report.dailyTokenLimit,
    tokensUsedToday: report.tokensUsedToday,
    totals: sumTotals(report.organizations),
  }
}

/**
 * A `DateTime?` query parameter. Absent, blank or unparseable reads as omitted so `AiUsageService`
 * applies its own default - the current UTC month for `fromUtc`, now for `toUtc`.
 *
 * **A KNOWN DIVERGENCE, deliberate**, and the same one `optionalInt` records at length in
 * `common/request-values.ts`: ASP.NET did not bind an unparseable `DateTime?` to null, it answered
 * a model-binding 400 whose message is ASP.NET's own resource string. No fixture records one, so
 * implementing the 400 means guessing the wording. Kept local rather than added to
 * `request-values.ts` because these two routes are the only date query parameters in the API.
 */
function optionalDate(value: unknown): Date | undefined {
  const text = optional(value)
  if (text === null) {
    return undefined
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * AI consumption reporting (`SPEC/30-Contracts.md` "AI Idea Assist Contracts").
 *
 * Read-only: nothing here mutates organization content, so the Site-Admin org-content refusal does
 * not apply. Cost is computed from the rates stored on each usage record rather than from current
 * configuration, so a pricing change never re-prices history - that is `AiUsageService`'s, and the
 * reason `estimatedCost` arrives already summed.
 *
 * `@Roles(...)` is a coarse first gate; `AiUsageService` re-checks the role and, for an Org Admin
 * naming someone else's organization, answers `404` rather than `403` so the response cannot
 * confirm that the organization exists.
 *
 * `@Controller()` carries no prefix - the two routes sit under different roots.
 */
@Controller()
export class AiUsageController {
  constructor(private readonly usage: AiUsageService) {}

  /**
   * Platform-wide consumption, one row per organization, ordered by total tokens descending.
   *
   * Rows cover every organization with usage in the window, archived ones included: spend already
   * incurred does not disappear when an organization is archived.
   */
  @Get('ai-assist/usage')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SiteAdmin)
  async platformUsage(@Query() query: Record<string, unknown>): Promise<AiUsageResponse> {
    return toResponse(
      await this.usage.getPlatformUsage(optionalDate(query.fromUtc), optionalDate(query.toUtc)),
    )
  }

  /** One organization's consumption. Site Admin may read any; an Org Admin only their own. */
  @Get('organizations/:organizationId/ai-assist/usage')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OrgAdmin, Role.SiteAdmin)
  async organizationUsage(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<AiUsageResponse> {
    return toResponse(
      await this.usage.getOrganizationUsage(
        organizationId,
        optionalDate(query.fromUtc),
        optionalDate(query.toUtc),
      ),
    )
  }
}
