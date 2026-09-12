// AI cost controls and usage reporting (SPEC/20-feature-ai-idea-assist.md rules 26, 28a-28e).
//
// Two things here are load-bearing beyond the obvious role checks. First, the rate limit and the
// strike history are counted against the REAL administrator, so switching who you act as does not
// reset your allowance. Second, usage is attributed to the IMPERSONATED user's organization, so a
// Site Admin drafting on behalf of Acme spends Acme's budget rather than nobody's.

import type { AiUsageRecord } from '@collega/domain/ai'
import { AiCallOutcome, Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { AiUsageService } from '../../src/ai/ai-usage.service.js'
import type { AiUsageLimits, AiUsageSummary } from '../../src/ai/models.js'
import { DEFAULT_AI_USAGE_LIMITS } from '../../src/ai/models.js'
import type { AiUsageRepository } from '../../src/ai/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import {
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '../../src/common/index.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'

type CountCall = { organizationId: string; actorUserId: string | null; fromUtc: Date }

function harness(options: {
  currentUser: CurrentUserContext
  limits?: Partial<AiUsageLimits>
  totalTokensToday?: number
  counts?: { organizationCalls: number; actorCalls: number }
  summaries?: readonly AiUsageSummary[]
  recentOutcomes?: readonly AiCallOutcome[]
  now?: Date
}) {
  const added: AiUsageRecord[] = []
  const updated: AiUsageRecord[] = []
  const countCalls: CountCall[] = []
  const outcomeCalls: { organizationId: string; actorUserId: string | null; boardId: string }[] = []
  const usageWindows: { from: Date; to: Date; organizationId: string | null | undefined }[] = []

  const usageRepository: AiUsageRepository = {
    async add(record) {
      added.push(record)
    },
    async update(record) {
      updated.push(record)
    },
    async getTotalTokensSince() {
      return options.totalTokensToday ?? 0
    },
    async getUsageByOrganization(fromUtc, toUtc, organizationId) {
      usageWindows.push({ from: fromUtc, to: toUtc, organizationId })
      return options.summaries ?? []
    },
    async countCallsSince(organizationId, actorUserId, fromUtc) {
      countCalls.push({ organizationId, actorUserId, fromUtc })
      return options.counts ?? { organizationCalls: 0, actorCalls: 0 }
    },
    async getRecentOutcomes(organizationId, actorUserId, boardId) {
      outcomeCalls.push({ organizationId, actorUserId, boardId })
      return options.recentOutcomes ?? []
    },
  }

  return {
    service: new AiUsageService(
      usageRepository,
      countingUnitOfWork(),
      options.currentUser,
      fixedClock(options.now ?? NOW),
      { ...DEFAULT_AI_USAGE_LIMITS, ...options.limits },
    ),
    added,
    updated,
    countCalls,
    outcomeCalls,
    usageWindows,
  }
}

describe('AiUsageService daily budget', () => {
  it('allows a call under the ceiling and refuses one at it', async () => {
    const under = harness({
      currentUser: member(ORG_A),
      limits: { dailyTokenLimit: 1000 },
      totalTokensToday: 999,
    })
    const at = harness({
      currentUser: member(ORG_A),
      limits: { dailyTokenLimit: 1000 },
      totalTokensToday: 1000,
    })

    await expect(under.service.isWithinDailyBudget()).resolves.toBe(true)
    await expect(at.service.isWithinDailyBudget()).resolves.toBe(false)
  })

  it('treats a non-positive ceiling as no ceiling at all', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      limits: { dailyTokenLimit: 0 },
      totalTokensToday: 10_000_000,
    })

    await expect(service.isWithinDailyBudget()).resolves.toBe(true)
  })
})

describe('AiUsageService rate limit', () => {
  it('counts against the REAL administrator during View As, not the impersonated user', async () => {
    const { service, countCalls } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await service.enforceRateLimit(ORG_A)

    expect(countCalls[0]?.actorUserId).toBe('sa-9')
  })

  it('refuses once the per-user limit is reached, with a Retry-After', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      limits: { perUserCallsPerWindow: 3, rateLimitWindowSeconds: 60 },
      counts: { organizationCalls: 3, actorCalls: 3 },
    })

    const error = await service.enforceRateLimit(ORG_A).catch((e: RateLimitedError) => e)

    expect(error).toBeInstanceOf(RateLimitedError)
    expect((error as RateLimitedError).retryAfterSeconds).toBe(60)
  })

  it('refuses once the per-organization limit is reached even when the caller is under theirs', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      limits: { perUserCallsPerWindow: 10, perOrganizationCallsPerWindow: 5 },
      counts: { organizationCalls: 5, actorCalls: 1 },
    })

    await expect(service.enforceRateLimit(ORG_A)).rejects.toThrow(RateLimitedError)
  })

  it('does nothing when rate limiting is switched off', async () => {
    const { service, countCalls } = harness({
      currentUser: member(ORG_A),
      limits: { perUserCallsPerWindow: 0, perOrganizationCallsPerWindow: 0 },
    })

    await expect(service.enforceRateLimit(ORG_A)).resolves.toBeUndefined()
    expect(countCalls).toHaveLength(0)
  })

  it('measures the window from the injected clock', async () => {
    const { service, countCalls } = harness({
      currentUser: member(ORG_A),
      limits: { rateLimitWindowSeconds: 120 },
    })

    await service.enforceRateLimit(ORG_A)

    expect(countCalls[0]?.fromUtc.getTime()).toBe(NOW.getTime() - 120_000)
  })
})

describe('AiUsageService reservation and settlement', () => {
  it('books a Failed row at the estimate before anything is spent', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A) })

    const reservation = await service.reserveUsage({
      organizationId: ORG_A,
      boardId: 'board-a',
      estimatedTokens: 12_345,
    })

    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({
      organizationId: ORG_A,
      outcome: AiCallOutcome.Failed,
      inputTokens: 12_345,
      outputTokens: 0,
    })
    expect(reservation.reservedTokens).toBe(12_345)
  })

  it('attributes usage to the administrator, on behalf of the impersonated user', async () => {
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await service.reserveUsage({ organizationId: ORG_A, boardId: null, estimatedTokens: 100 })

    expect(added[0]?.actorUserId).toBe('sa-9')
    expect(added[0]?.onBehalfOfUserId).toBe('target-1')
  })

  it('rewrites the SAME row on settlement, keeping id and timestamp', async () => {
    const { service, updated } = harness({ currentUser: member(ORG_A) })

    const reservation = await service.reserveUsage({
      organizationId: ORG_A,
      boardId: 'board-a',
      estimatedTokens: 100,
    })
    await service.settleUsage(reservation, AiCallOutcome.Succeeded, {
      inputTokens: 900,
      outputTokens: 120,
      cacheReadInputTokens: 40,
      cacheCreationInputTokens: 0,
    })

    expect(updated[0]?.id).toBe(reservation.id)
    expect(updated[0]?.occurredAtUtc).toEqual(reservation.occurredAtUtc)
    expect(updated[0]).toMatchObject({ outcome: AiCallOutcome.Succeeded, inputTokens: 900 })
  })

  it('leaves the reservation standing when the provider reported nothing', async () => {
    const { service, updated } = harness({ currentUser: member(ORG_A) })

    const reservation = await service.reserveUsage({
      organizationId: ORG_A,
      boardId: null,
      estimatedTokens: 100,
    })
    await service.settleUsage(reservation, AiCallOutcome.Failed, null)

    expect(updated).toHaveLength(0)
  })

  it('captures the configured rates on the row, so re-pricing never restates history', async () => {
    const { service, added } = harness({
      currentUser: member(ORG_A),
      limits: { inputRatePerMillion: 3, outputRatePerMillion: 15 },
    })

    await service.reserveUsage({ organizationId: ORG_A, boardId: null, estimatedTokens: 10 })

    expect(added[0]).toMatchObject({ inputRatePerMillion: 3, outputRatePerMillion: 15 })
  })
})

describe('AiUsageService.getRecentOutcomes', () => {
  it('scopes the strike history to the real administrator, so switching targets does not wipe it', async () => {
    const { service, outcomeCalls } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await service.getRecentOutcomes(ORG_A, 'board-a', 3, NOW)

    expect(outcomeCalls[0]?.actorUserId).toBe('sa-9')
  })
})

describe('AiUsageService reporting authorization', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s the platform-wide report', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.getPlatformUsage()).rejects.toThrow(ForbiddenError)
  })

  it('lets a Site Admin read the platform report, with the ceiling and today’s total', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      limits: { dailyTokenLimit: 500_000 },
      totalTokensToday: 1234,
    })

    await expect(service.getPlatformUsage()).resolves.toMatchObject({
      dailyTokenLimit: 500_000,
      tokensUsedToday: 1234,
    })
  })

  it('lets an Org Admin read their own organization and refuses another, as not-found', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.getOrganizationUsage(ORG_A)).resolves.toBeDefined()
    await expect(service.getOrganizationUsage(ORG_B)).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s the organization report, including their own', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.getOrganizationUsage(ORG_A)).rejects.toThrow(ForbiddenError)
  })

  it('omits the platform ceiling from an organization report - it is not an org’s business', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), limits: { dailyTokenLimit: 9000 } })

    const report = await service.getOrganizationUsage(ORG_A)

    expect(report.dailyTokenLimit).toBeNull()
    expect(report.tokensUsedToday).toBeNull()
  })

  it('scopes the organization report query to that organization', async () => {
    const { service, usageWindows } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.getOrganizationUsage(ORG_A)

    expect(usageWindows[0]?.organizationId).toBe(ORG_A)
  })

  it('defaults the window to the current UTC month', async () => {
    const { service, usageWindows } = harness({
      currentUser: siteAdmin(),
      now: new Date('2026-09-17T08:30:00.000Z'),
    })

    await service.getPlatformUsage()

    expect(usageWindows[0]?.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(usageWindows[0]?.to.toISOString()).toBe('2026-09-17T08:30:00.000Z')
  })

  it('rejects an inverted range rather than silently reporting no usage', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(
      service.getPlatformUsage(new Date('2026-09-10'), new Date('2026-09-01')),
    ).rejects.toThrow(ValidationError)
  })
})
