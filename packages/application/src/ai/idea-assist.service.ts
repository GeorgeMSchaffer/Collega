import { AiCallOutcome, Priority, Role } from '@collega/domain/enums'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@collega/domain/ideas'
import {
  ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH,
  setOrganizationAiScopeStatement,
} from '@collega/domain/organizations'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import { AiAssistUnavailableError } from './errors.js'
import type { IdeaAssistContextBuilder } from './idea-assist-context-builder.js'
import type {
  AiAssistSettings,
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaAssistTurnRequest,
  IdeaAssistTurnResult,
  IdeaDraft,
  IdeaDraftModelResponse,
} from './models.js'
import { businessImpactIdsOf, EMPTY_IDEA_DRAFT, ideaTypeIdsOf, isUserTurn } from './models.js'
import type {
  AiBoardLookupPort,
  AiOrganizationRepository,
  AiUsageGate,
  IdeaDraftModel,
} from './ports.js'
import { IdeaDraftModelError } from './ports.js'

/**
 * Rule 5. A conversation this long has stopped being idea drafting. The cap counts transcript
 * ENTRIES - user and assistant combined - not user turns. Since a transcript alternates and must
 * end with a user entry, the largest valid request carries 19, so this is 10 user turns.
 */
export const MAX_TRANSCRIPT_ENTRIES = 20

/** Rule 10. Bounds the cost of someone probing the boundary. */
export const OUT_OF_SCOPE_STRIKE_LIMIT = 3

/**
 * How far back a strike still counts. A conversation is capped at 20 entries and runs in
 * minutes, so an hour is generous - but bounded, so yesterday's refusals don't close today's
 * chat before it starts.
 */
const CONVERSATION_LOOKBACK_MS = 60 * 60 * 1000

/**
 * The idea-drafting use case (SPEC/20-feature-ai-idea-assist.md; contract
 * `POST /boards/{boardId}/idea-assist/turns`). Owns everything the model is not trusted with:
 * authorization, retrieval scoping, the scope gate, re-validation of returned ids, the turn caps,
 * and metering.
 *
 * NEVER A WRITE PATH (rule 23). Its output seeds a form; the user submits it; the existing idea
 * service's validation is the sole authority on whether an idea is created. No method here
 * creates, updates, or deletes anything except a usage record and an audit event.
 *
 * Degradation is the default, not the exception. A provider failure, an unconfigured key, or an
 * exhausted budget all raise `AiAssistUnavailableError`, which the API maps to 503 - the three
 * causes are deliberately indistinguishable to the client, which falls back to the scripted
 * brainstorm either way (rules 31-32).
 */
export class IdeaAssistService {
  constructor(
    private readonly model: IdeaDraftModel,
    private readonly contextBuilder: IdeaAssistContextBuilder,
    private readonly boards: AiBoardLookupPort,
    private readonly organizations: AiOrganizationRepository,
    private readonly usage: AiUsageGate,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  /**
   * Whether a drafting turn would be attempted right now (rule 32a). A SNAPSHOT, not a
   * guarantee: the budget can be exhausted between this call and the next turn, so a caller must
   * still handle `AiAssistUnavailableError` from `continueTurn` (rule 32b).
   *
   * Exactly the gate `continueTurn` applies before calling the provider, so the answer cannot
   * drift from the behaviour it predicts. No authorization beyond authentication and no
   * organization scope: it reports deployment state, reads nothing org-owned, and is metered by
   * neither the budget nor the rate limiter - it makes no provider call.
   */
  async isAvailable(): Promise<boolean> {
    return this.model.isConfigured && (await this.usage.isWithinDailyBudget())
  }

  async continueTurn(request: IdeaAssistTurnRequest): Promise<IdeaAssistTurnResult> {
    const organizationId = this.requireDraftingMember()
    this.validateTranscript(request.transcript)

    const board = await this.boards.getById(request.boardId)

    // 404, not 403, for a board outside the caller's organization: a wrong-org request must not
    // confirm the board exists. Same shape as every other org-scoped read in the codebase.
    if (!board || board.organizationId !== organizationId) {
      throw new NotFoundError('Board not found.')
    }

    // Two states the client cannot distinguish, and must not: no key configured, and the
    // deployment's daily token budget exhausted (rules 28a, 31).
    if (!this.model.isConfigured || !(await this.usage.isWithinDailyBudget())) {
      throw new AiAssistUnavailableError()
    }

    // Rate limits are 429, deliberately NOT folded into the 503 above: unavailable means "stop
    // asking, work without it", rate-limited means "you asked too fast, try again shortly". A
    // client that cannot tell those apart either gives up too early or retries a dead endpoint.
    await this.usage.enforceRateLimit(organizationId)

    const userTurnCount = request.transcript.filter(isUserTurn).length
    const currentDraft = request.draft ?? EMPTY_IDEA_DRAFT

    const context = await this.contextBuilder.build(organizationId)

    let response: IdeaDraftModelResponse
    try {
      response = await this.model.continueTurn(context, request.transcript, currentDraft)
    } catch (error) {
      if (!(error instanceof IdeaDraftModelError)) {
        throw error
      }
      // The turn consumed tokens even though it failed, so it is still metered (rule 28c) - a
      // meter that counted only successes would not bound spend.
      await this.recordUsage(organizationId, request.boardId, AiCallOutcome.Failed, null)
      await this.audit(organizationId, request.boardId, userTurnCount, false, true)
      throw new AiAssistUnavailableError()
    }

    const outcome = response.inScope ? AiCallOutcome.Succeeded : AiCallOutcome.Refused
    await this.recordUsage(organizationId, request.boardId, outcome, response)
    await this.audit(organizationId, request.boardId, userTurnCount, !response.inScope, false)

    if (!response.inScope) {
      // The draft is returned unchanged and the client drops the offending turn rather than
      // appending it: accumulated off-topic context is what drifts a constrained assistant into
      // a general one (rule 8).
      const closed = await this.isThirdConsecutiveRefusal(organizationId, request.boardId)

      return {
        inScope: false,
        conversationClosed: closed,
        // From the active prompt version, falling back to the built-in default (rule 34).
        nextQuestion: closed
          ? context.prompts.conversationClosedRedirect
          : context.prompts.outOfScopeRedirect,
        draft: currentDraft,
        // The client drops the offending user turn and renders the redirect as a system note
        // rather than an assistant bubble (rule 8/8a), so the transcript shrinks by one and a
        // refused turn costs no conversation budget.
        turnsRemaining: this.remainingUserTurns(request.transcript.length - 1),
      }
    }

    // Every id the model returned is re-checked against what was actually retrieved. The schema
    // already makes an out-of-org id structurally impossible; this is the belt to that braces,
    // and it is what the contract promises (line 1274).
    const draft = sanitizeDraft(response.draft, context, currentDraft)
    // The client appends this reply, so the transcript it will hold is one longer than the request.
    const turnsRemaining = this.remainingUserTurns(request.transcript.length + 1)

    return {
      inScope: true,
      conversationClosed: turnsRemaining === 0,
      nextQuestion: response.nextQuestion,
      draft,
      turnsRemaining,
    }
  }

  async getSettings(organizationId: string): Promise<AiAssistSettings> {
    const organization = await this.requireAdministrableOrganization(organizationId)
    // Reports WHETHER a key is configured, never the key or any part of it (rule 28).
    return {
      aiAssistAvailable: this.model.isConfigured,
      scopeStatement: organization.aiScopeStatement,
    }
  }

  async setScopeStatement(
    organizationId: string,
    scopeStatement: string | null,
  ): Promise<AiAssistSettings> {
    // The scope statement is organization content, not platform configuration: it is what the
    // assistant refuses off-topic requests against, one organization's subject matter in its own
    // words. So it goes through View As like every other org-content mutation (rule 25). Reading
    // stays open to a direct Site Admin, as reads always are.
    ensureNotDirectSiteAdmin(this.currentUser)

    const organization = await this.requireAdministrableOrganization(organizationId)

    if (
      scopeStatement !== null &&
      scopeStatement.length > ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH
    ) {
      throw new ValidationError('One or more fields are invalid.', {
        scopeStatement: [
          `Scope statement cannot exceed ${ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH} characters.`,
        ],
      })
    }

    const now = this.clock.now()
    const updated = setOrganizationAiScopeStatement(
      organization,
      scopeStatement,
      now,
      this.currentUser.userId,
    )
    await this.organizations.update(updated)

    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType: 'AiScopeStatementUpdated',
      entityType: 'Organization',
      entityId: organizationId,
      organizationId,
      attribution,
      message: 'The AI assist scope statement was updated.',
      occurredAtUtc: now,
      // The new value is org configuration written by a trusted operator, not user content -
      // recording it is the point of the audit entry (contract: "the acting user and the new
      // value").
      metadataJson: JSON.stringify({ scopeStatement: updated.aiScopeStatement }),
    })

    await this.unitOfWork.saveChanges()

    return { aiAssistAvailable: this.model.isConfigured, scopeStatement: updated.aiScopeStatement }
  }

  // Internal helpers ------------------------------------------------------------------------

  private async recordUsage(
    organizationId: string,
    boardId: string,
    outcome: AiCallOutcome,
    response: IdeaDraftModelResponse | null,
  ): Promise<void> {
    await this.usage.recordUsage({
      organizationId,
      outcome,
      inputTokens: response?.inputTokens ?? 0,
      outputTokens: response?.outputTokens ?? 0,
      cacheReadInputTokens: response?.cacheReadInputTokens ?? 0,
      cacheCreationInputTokens: response?.cacheCreationInputTokens ?? 0,
      boardId,
    })
  }

  /**
   * Whether the refusal just recorded is the third consecutive one, closing the chat (rule 10).
   *
   * READ FROM THE USAGE RECORDS, NEVER FROM THE TRANSCRIPT. The client owns the transcript, and
   * it drops refused turns by design - so a strike count derived from it is both absent in the
   * normal case and trivially erasable by a caller probing the boundary. These rows are written
   * by the server on every turn and the caller cannot touch them.
   *
   * Called after the current turn has been recorded, so the newest row IS this refusal: three
   * consecutive refused outcomes on this board, by this actor, means close.
   */
  private async isThirdConsecutiveRefusal(
    organizationId: string,
    boardId: string,
  ): Promise<boolean> {
    const outcomes = await this.usage.getRecentOutcomes(
      organizationId,
      boardId,
      OUT_OF_SCOPE_STRIKE_LIMIT,
      new Date(this.clock.now().getTime() - CONVERSATION_LOOKBACK_MS),
    )

    return (
      outcomes.length >= OUT_OF_SCOPE_STRIKE_LIMIT &&
      outcomes.slice(0, OUT_OF_SCOPE_STRIKE_LIMIT).every((o) => o === AiCallOutcome.Refused)
    )
  }

  private validateTranscript(transcript: readonly IdeaAssistTurn[]): void {
    if (!transcript || transcript.length === 0) {
      throw new ValidationError('One or more fields are invalid.', {
        transcript: ['At least one message is required.'],
      })
    }

    if (transcript.length > MAX_TRANSCRIPT_ENTRIES) {
      throw new ValidationError('One or more fields are invalid.', {
        transcript: [`A conversation is capped at ${MAX_TRANSCRIPT_ENTRIES} transcript entries.`],
      })
    }

    if (!isUserTurn(transcript[transcript.length - 1] as IdeaAssistTurn)) {
      throw new ValidationError('One or more fields are invalid.', {
        transcript: ['The last message must be from the user.'],
      })
    }
  }

  /**
   * How many further user turns fit under rule 5, given the transcript length the client will
   * hold once this turn is applied. Each further turn costs a user entry plus the assistant
   * reply that comes back with it, and the request carrying turn `k` is `length + 2k - 1`
   * entries long - so the largest `k` with `length + 2k - 1 <= 20` is `(21 - length) / 2`.
   */
  private remainingUserTurns(transcriptLength: number): number {
    return Math.max(0, Math.floor((MAX_TRANSCRIPT_ENTRIES + 1 - transcriptLength) / 2))
  }

  /** Anyone who may create ideas in their organization may draft. Read Only is refused (the
   * contract's "authorized for any member of the board's organization who may create ideas"). */
  private requireDraftingMember(): string {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    if (this.currentUser.role === Role.ReadOnly) {
      throw new ForbiddenError('Read Only users cannot draft ideas.')
    }

    // A Site Admin acting as themselves has no organization, and drafting is organization work -
    // they reach it through View As, exactly like every other org-content path (view-as rule 25).
    if (this.currentUser.organizationId === null) {
      throw new ForbiddenError(
        'Drafting is organization work — act as a member of the organization.',
      )
    }

    return this.currentUser.organizationId
  }

  private async requireAdministrableOrganization(organizationId: string) {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    const role = this.currentUser.role

    if (role !== Role.SiteAdmin && role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to administer this organization.')
    }

    if (role === Role.OrgAdmin && this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }

    const organization = await this.organizations.getById(organizationId)
    if (!organization) {
      throw new NotFoundError('Organization not found.')
    }

    return organization
  }

  /**
   * Rule 27's audit entry: who, where, how far in, and how it ended - and NEVER the prompt or
   * the transcript. The usage record next to it carries the token counts; this one is the
   * accountability trail, and neither is derived from the other.
   */
  private async audit(
    organizationId: string,
    boardId: string,
    turnCount: number,
    outOfScope: boolean,
    failed: boolean,
  ): Promise<void> {
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)

    await this.auditEvents.write({
      eventType: 'IdeaAssistTurn',
      entityType: 'Board',
      entityId: boardId,
      organizationId,
      attribution,
      message: 'An AI idea-assist turn was requested.',
      occurredAtUtc: this.clock.now(),
      metadataJson: JSON.stringify({ boardId, turnCount, outOfScope, failed }),
    })
  }
}

/**
 * Drops anything the model returned that is not a real, active option in the retrieved set, and
 * clamps free text to the domain maxima. A rejected id falls back to whatever the draft already
 * held rather than to null - a bad suggestion must not erase a good earlier one.
 */
function sanitizeDraft(
  proposed: IdeaDraft,
  context: IdeaAssistContext,
  current: IdeaDraft,
): IdeaDraft {
  const activeIdeaTypeIds = ideaTypeIdsOf(context)
  const activeBusinessImpactIds = businessImpactIdsOf(context)

  const ideaTypeId =
    proposed.ideaTypeId !== null && activeIdeaTypeIds.includes(proposed.ideaTypeId)
      ? proposed.ideaTypeId
      : current.ideaTypeId

  const businessImpactId =
    proposed.businessImpactId !== null &&
    activeBusinessImpactIds.includes(proposed.businessImpactId)
      ? proposed.businessImpactId
      : current.businessImpactId

  return {
    title: truncate(proposed.title, TITLE_MAX_LENGTH) ?? current.title,
    description: truncate(proposed.description, DESCRIPTION_MAX_LENGTH) ?? current.description,
    ideaTypeId,
    businessImpactId,
    priority:
      proposed.priority !== null && Object.values(Priority).includes(proposed.priority)
        ? proposed.priority
        : current.priority,
  }
}

/**
 * JavaScript strings are UTF-16 code units, same as C#, so the surrogate-pair boundary check
 * ported from .NET applies unchanged: cutting between a surrogate pair produces an invalid
 * string, and a lone surrogate would fail validation on the create form the user is about to
 * submit.
 */
function truncate(value: string | null, maxLength: number): string | null {
  if (!value || value.trim().length === 0) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  let end = maxLength
  const code = trimmed.charCodeAt(end - 1)
  if (code >= 0xd800 && code <= 0xdbff) {
    end--
  }

  return trimmed.slice(0, end)
}
