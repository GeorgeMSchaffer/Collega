import type { AiUsageReport, AiUsageSummary } from '@collega/application/ai'
import {
  AiUsageService,
  reportTotalCalls,
  reportTotalEstimatedCost,
  reportTotalTokens,
} from '@collega/application/ai'
import { Role } from '@collega/domain/enums'
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { Roles } from '../auth/roles.decorator.js'
import { RolesGuard } from '../auth/roles.guard.js'
import { optional } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/**
 * The wire shape of a usage report. `AiUsageReport` carries the window, the rows and the ceiling;
 * the three totals are free functions beside it (`reportTotalCalls` and friends) rather than
 * fields, because the .NET record computed them as properties and System.Text.Json serialized them
 * flat. Composing them here keeps the response identical without giving the Application model
 * derived state to keep consistent.
 *
 * `dailyTokenLimit` and `tokensUsedToday` are null on the single-organization report: the ceiling
 * is platform-wide and is not an organization's business.
 */
type AiUsageResponse = {
  fromUtc: Date
  toUtc: Date
  organizations: readonly AiUsageSummary[]
  dailyTokenLimit: number | null
  tokensUsedToday: number | null
  totalCalls: number
  totalTokens: number
  totalEstimatedCost: number
}

function toResponse(report: AiUsageReport): AiUsageResponse {
  return {
    fromUtc: report.fromUtc,
    toUtc: report.toUtc,
    organizations: report.organizations,
    dailyTokenLimit: report.dailyTokenLimit,
    tokensUsedToday: report.tokensUsedToday,
    totalCalls: reportTotalCalls(report),
    totalTokens: reportTotalTokens(report),
    totalEstimatedCost: reportTotalEstimatedCost(report),
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
