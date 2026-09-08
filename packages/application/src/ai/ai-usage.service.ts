import { randomUUID } from 'node:crypto'
import type { AiUsageRecord } from '@collega/domain/ai'
import { createAiUsageRecord } from '@collega/domain/ai'
import { AiCallOutcome, Role } from '@collega/domain/enums'
import {
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type {
  AiTokenUsage,
  AiUsageLimits,
  AiUsageReport,
  AiUsageReservation,
  ReserveAiUsageInput,
} from './models.js'
import { isRateLimited, isUsageEnforced } from './models.js'
import type { AiUsageGate, AiUsageRepository } from './ports.js'

/**
 * The AI cost controls: the daily token budget gate and the per-organization usage reports
 * (SPEC/20-feature-ai-idea-assist.md rules 28a-28e).
 *
 * Deliberately separate from the idea-assist use case. The gate and the meter are about what the
 * deployment key may spend and who spent it; they are not part of drafting an idea, and keeping
 * them apart means this service has no dependency on the model provider at all.
 */
export class AiUsageService implements AiUsageGate {
  constructor(
    private readonly usageRepository: AiUsageRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly limits: AiUsageLimits,
  ) {}

  /**
   * Whether another model call is allowed under today's ceiling (rule 28a).
   *
   * Compares the day's COMMITTED total against the ceiling, which is only a gate for a caller
   * that has already committed its own turn as a reservation (`reserveUsage`). Rule 28a's
   * "overshoot is bounded by one in-flight turn" is a statement about serial execution; this runs
   * serverless, where a hundred invocations can read this total in the same millisecond and every
   * one of them is under it. The reservation is what makes that sentence true again.
   */
  async isWithinDailyBudget(): Promise<boolean> {
    if (!isUsageEnforced(this.limits)) {
      return true
    }

    const used = await this.usageRepository.getTotalTokensSince(this.startOfUtcToday())
    return used < this.limits.dailyTokenLimit
  }

  /**
   * Enforces the per-user and per-organization request limits (rule 26). Called once the turn's
   * own reservation is committed and before the provider, like the budget gate - a rate limit
   * that only notices after the call has been paid for is not a rate limit, and one that counts
   * only turns which have already finished cannot see the burst it exists to stop.
   *
   * Counted from the usage records themselves rather than a separate counter: they already carry
   * organization, actor and timestamp, they are already written for every turn including refused
   * and failed ones, and - unlike an in-memory counter - the tally is correct across instances
   * the moment the deployment scales past one, which matters on Vercel where there is no
   * in-process state to hold a counter in at all.
   *
   * Because refused turns are counted, probing the scope boundary spends allowance. That is
   * deliberate: rule 10's three-strikes close bounds one conversation, this bounds the attempt to
   * open many.
   */
  async enforceRateLimit(organizationId: string): Promise<void> {
    if (!isRateLimited(this.limits)) {
      return
    }

    const windowMs = this.limits.rateLimitWindowSeconds * 1000
    const counts = await this.usageRepository.countCallsSince(
      organizationId,
      // The real administrator during a View As session, never the impersonated user -
      // otherwise switching who you act as would reset your own allowance.
      this.currentUser.realUserId,
      new Date(this.clock.now().getTime() - windowMs),
    )

    const retryAfterSeconds = Math.max(1, this.limits.rateLimitWindowSeconds)

    if (
      this.limits.perUserCallsPerWindow > 0 &&
      counts.actorCalls >= this.limits.perUserCallsPerWindow
    ) {
      throw new RateLimitedError(
        "You've made too many assistant requests just now. Give it a moment and try again.",
        retryAfterSeconds,
      )
    }

    if (
      this.limits.perOrganizationCallsPerWindow > 0 &&
      counts.organizationCalls >= this.limits.perOrganizationCallsPerWindow
    ) {
      throw new RateLimitedError(
        'Your organization has made too many assistant requests just now. Give it a moment and try again.',
        retryAfterSeconds,
      )
    }
  }

  /**
   * Books this turn's usage row before a token has been spent, so both counters can see it while
   * it is still in flight, and commits it immediately - a row still sitting in the unit of work
   * is invisible to the concurrent invocation it exists to be visible to.
   *
   * The row is written as `Failed` at the estimate. That is not a placeholder state; it is what
   * the row should say if this request never gets any further. A process that dies between here
   * and the provider therefore leaves a complete, honest record of a turn that started and
   * produced nothing - not a pending row needing a sweeper - and it stops counting on its own,
   * leaving the rate-limit window after `rateLimitWindowSeconds` and the budget at the next UTC
   * midnight. Nothing has to run for a tenant to get its allowance back.
   *
   * `input.organizationId` is the organization the work belongs to. Callers pass
   * `CurrentUserContext.organizationId`, which during a View As session is the IMPERSONATED
   * user's organization (view-as rule 15) - so a Site Admin drafting on behalf of an
   * organization spends that organization's budget, not nobody's.
   */
  async reserveUsage(input: ReserveAiUsageInput): Promise<AiUsageReservation> {
    const id = randomUUID()
    const occurredAtUtc = this.clock.now()
    const boardId = input.boardId ?? null

    // The whole estimate rides on input tokens. The budget gate sums all four counts, and the
    // split is meaningless until the provider's own numbers replace it.
    await this.usageRepository.add(
      this.buildRecord(id, input.organizationId, boardId, occurredAtUtc, AiCallOutcome.Failed, {
        inputTokens: input.estimatedTokens,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      }),
    )
    await this.unitOfWork.saveChanges()

    return {
      id,
      organizationId: input.organizationId,
      boardId,
      occurredAtUtc,
      reservedTokens: input.estimatedTokens,
    }
  }

  /**
   * Replaces the reservation with what the call actually consumed and how it actually ended -
   * refused and failed turns included, which consumed tokens too (rule 28c).
   *
   * Same id and same `occurredAtUtc`, so the settlement rewrites the turn rather than adding a
   * second one: a new row would count twice against the rate limit and would land ahead of itself
   * in `getRecentOutcomes`, which rule 10's three-strikes close reads.
   *
   * `usage` of `null` leaves the reservation exactly as booked. It means the provider was
   * reached but reported nothing - a timeout, a dropped connection - and such a call may well
   * have been billed in full. Rewriting it to zero would make a failure loop free, which is
   * precisely the hole rule 28a's ceiling exists to close.
   */
  async settleUsage(
    reservation: AiUsageReservation,
    outcome: AiCallOutcome,
    usage: AiTokenUsage | null,
  ): Promise<void> {
    if (usage === null) {
      return
    }

    await this.usageRepository.update(
      this.buildRecord(
        reservation.id,
        reservation.organizationId,
        reservation.boardId,
        reservation.occurredAtUtc,
        outcome,
        usage,
      ),
    )
    await this.unitOfWork.saveChanges()
  }

  private buildRecord(
    id: string,
    organizationId: string,
    boardId: string | null,
    occurredAtUtc: Date,
    outcome: AiCallOutcome,
    usage: AiTokenUsage,
  ): AiUsageRecord {
    // Same actor/on-behalf-of split the audit trail uses: the actor stays the real administrator
    // so a row can never read as though the impersonated user did it themselves.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)

    return createAiUsageRecord({
      id,
      organizationId,
      model: this.limits.model,
      occurredAtUtc,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens,
      cacheCreationInputTokens: usage.cacheCreationInputTokens,
      inputRatePerMillion: this.limits.inputRatePerMillion,
      outputRatePerMillion: this.limits.outputRatePerMillion,
      outcome,
      actorUserId: attribution.actorUserId,
      onBehalfOfUserId: attribution.onBehalfOfUserId,
      boardId,
    })
  }

  /**
   * Recent outcomes for the current actor on one board. Scoped to the REAL actor for the same
   * reason the rate limit is: switching who you act as must not wipe your history.
   */
  getRecentOutcomes(
    organizationId: string,
    boardId: string,
    limit: number,
    fromUtc: Date,
  ): Promise<readonly AiCallOutcome[]> {
    return this.usageRepository.getRecentOutcomes(
      organizationId,
      this.currentUser.realUserId,
      boardId,
      limit,
      fromUtc,
    )
  }

  /** Platform-wide consumption, one entry per organization. Site Admin only. */
  async getPlatformUsage(fromUtc?: Date, toUtc?: Date): Promise<AiUsageReport> {
    if (this.requireAuthenticatedRole() !== Role.SiteAdmin) {
      throw new ForbiddenError('Only a Site Admin can view platform-wide AI usage.')
    }

    const { from, to } = this.resolveWindow(fromUtc, toUtc)
    const organizations = await this.usageRepository.getUsageByOrganization(from, to, null)
    const tokensUsedToday = await this.usageRepository.getTotalTokensSince(this.startOfUtcToday())

    return {
      fromUtc: from,
      toUtc: to,
      organizations,
      dailyTokenLimit: this.limits.dailyTokenLimit,
      tokensUsedToday,
    }
  }

  /**
   * One organization's consumption. Site Admin may read any; Org Admin only their own. The
   * ceiling is omitted - it is platform-wide and not an organization's business.
   */
  async getOrganizationUsage(
    organizationId: string,
    fromUtc?: Date,
    toUtc?: Date,
  ): Promise<AiUsageReport> {
    const role = this.requireAuthenticatedRole()

    if (role !== Role.SiteAdmin && role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to view AI usage.')
    }

    // 404 rather than 403 for an out-of-scope organization, matching the organizations service:
    // a wrong-org request must not confirm that the organization exists.
    if (role === Role.OrgAdmin && this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }

    const { from, to } = this.resolveWindow(fromUtc, toUtc)
    const organizations = await this.usageRepository.getUsageByOrganization(
      from,
      to,
      organizationId,
    )

    return { fromUtc: from, toUtc: to, organizations, dailyTokenLimit: null, tokensUsedToday: null }
  }

  /**
   * Defaults to the current UTC month, per the contract. An inverted range is a caller error
   * rather than an empty result - silently returning nothing would read as "no usage".
   */
  private resolveWindow(
    fromUtc: Date | undefined,
    toUtc: Date | undefined,
  ): { from: Date; to: Date } {
    const now = this.clock.now()
    const from = fromUtc ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const to = toUtc ?? now

    if (to < from) {
      throw new ValidationError('One or more fields are invalid.', {
        toUtc: ['The end of the range cannot be before the start.'],
      })
    }

    return { from, to }
  }

  /**
   * Midnight UTC. The day boundary is UTC because there is no per-organization timezone in the
   * model and the ceiling is one shared pool - a per-org local midnight would have no single
   * meaning to reset on.
   */
  private startOfUtcToday(): Date {
    const now = this.clock.now()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }
}
