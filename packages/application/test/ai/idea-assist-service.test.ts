// AI idea assist (SPEC/20-feature-ai-idea-assist.md, SPEC/40-test-strategy.md "AI Idea Assist").
//
// The single most important assertion in this file is the one the test strategy names as such:
// a model response naming an out-of-organization or inactive id is rejected server-side and never
// reaches the client. Everything the model returns is untrusted; the retrieved context is the
// only authority on what a valid id is.

import { AiCallOutcome, type Priority, Role } from '@collega/domain/enums'
import { createOrganization, type Organization } from '@collega/domain/organizations'
import { describe, expect, it } from 'vitest'
import { AiAssistUnavailableError } from '../../src/ai/errors.js'
import {
  IdeaAssistService,
  MAX_TRANSCRIPT_ENTRIES,
  TRANSCRIPT_ENTRY_MAX_LENGTH,
} from '../../src/ai/idea-assist.service.js'
import type { IdeaAssistContextBuilder } from '../../src/ai/idea-assist-context-builder.js'
import type {
  AiTokenUsage,
  AiUsageReservation,
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaDraft,
  IdeaDraftModelResponse,
  ReserveAiUsageInput,
} from '../../src/ai/models.js'
import { EMPTY_IDEA_DRAFT } from '../../src/ai/models.js'
import type {
  AiBoardLookupPort,
  AiOrganizationRepository,
  AiUsageGate,
  IdeaDraftModel,
} from '../../src/ai/ports.js'
import { IdeaDraftModelError } from '../../src/ai/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
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
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const BOARD_A = 'board-a'
const BOARD_B = 'board-b'
const TYPE_A = 'type-a'
const IMPACT_A = 'impact-a'

function context(overrides: Partial<IdeaAssistContext> = {}): IdeaAssistContext {
  return {
    organizationId: ORG_A,
    organizationName: 'Acme',
    scopeStatement: null,
    ideaTypes: [{ id: TYPE_A, name: 'Improvement' }],
    businessImpacts: [{ id: IMPACT_A, name: 'Medium' }],
    statuses: ['New'],
    tags: [],
    memberNames: [],
    prompts: {
      systemPromptTemplate: 'template',
      outOfScopeRedirect: 'Let us stay on ideas.',
      conversationClosedRedirect: 'This conversation is closed.',
      version: 1,
    },
    ...overrides,
  }
}

function modelResponse(overrides: Partial<IdeaDraftModelResponse> = {}): IdeaDraftModelResponse {
  return {
    inScope: true,
    nextQuestion: 'What problem does this solve?',
    draft: EMPTY_IDEA_DRAFT,
    inputTokens: 1200,
    outputTokens: 300,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    ...overrides,
  }
}

const USER_TURN: IdeaAssistTurn = { role: 'user', text: 'We should simplify onboarding.' }

type Settlement = {
  reservation: AiUsageReservation
  outcome: AiCallOutcome
  usage: AiTokenUsage | null
}

function harness(options: {
  currentUser: CurrentUserContext
  isConfigured?: boolean
  withinBudget?: boolean
  response?: IdeaDraftModelResponse
  modelError?: unknown
  context?: IdeaAssistContext
  boards?: readonly { id: string; organizationId: string }[]
  organizations?: readonly Organization[]
  recentOutcomes?: readonly AiCallOutcome[]
  rateLimitError?: Error
}) {
  const boardsById = new Map(
    (options.boards ?? [{ id: BOARD_A, organizationId: ORG_A }]).map((b) => [b.id, b]),
  )
  const orgsById = new Map((options.organizations ?? []).map((o) => [o.id, o]))
  const settlements: Settlement[] = []
  const reservations: ReserveAiUsageInput[] = []
  const modelCalls: {
    context: IdeaAssistContext
    transcript: readonly IdeaAssistTurn[]
    draft: IdeaDraft
  }[] = []
  const updatedOrganizations: Organization[] = []

  const model: IdeaDraftModel = {
    isConfigured: options.isConfigured ?? true,
    async continueTurn(ctx, transcript, draft) {
      modelCalls.push({ context: ctx, transcript, draft })
      if (options.modelError) {
        throw options.modelError
      }
      return options.response ?? modelResponse()
    },
  }

  // Only `build` is reachable from the service; the builder's six retrieval ports are its own
  // business and constructing them here would test the fake, not the service.
  const contextBuilder = {
    async build() {
      return options.context ?? context()
    },
  } as unknown as IdeaAssistContextBuilder

  const boards: AiBoardLookupPort = {
    async getById(boardId) {
      return boardsById.get(boardId) ?? null
    },
  }

  const organizations: AiOrganizationRepository = {
    async getById(organizationId) {
      return orgsById.get(organizationId) ?? null
    },
    async update(organization) {
      updatedOrganizations.push(organization)
    },
  }

  const usage: AiUsageGate = {
    async isWithinDailyBudget() {
      return options.withinBudget ?? true
    },
    async enforceRateLimit() {
      if (options.rateLimitError) {
        throw options.rateLimitError
      }
    },
    async reserveUsage(input) {
      reservations.push(input)
      return {
        id: 'usage-1',
        organizationId: input.organizationId,
        boardId: input.boardId ?? null,
        occurredAtUtc: NOW,
        reservedTokens: input.estimatedTokens,
      }
    },
    async settleUsage(reservation, outcome, tokenUsage) {
      settlements.push({ reservation, outcome, usage: tokenUsage })
    },
    async getRecentOutcomes() {
      return options.recentOutcomes ?? []
    },
  }

  const audit = recordingAudit()

  return {
    service: new IdeaAssistService(
      model,
      contextBuilder,
      boards,
      organizations,
      usage,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    settlements,
    reservations,
    modelCalls,
    updatedOrganizations,
    audit,
  }
}

describe('IdeaAssistService classification cannot escape the organization', () => {
  it('drops an ideaTypeId the retrieved context does not contain', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        draft: { ...EMPTY_IDEA_DRAFT, ideaTypeId: 'type-from-org-b', title: 'A title' },
      }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.draft.ideaTypeId).toBeNull()
    expect(result.draft.title).toBe('A title')
  })

  it('drops a businessImpactId the retrieved context does not contain', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        draft: { ...EMPTY_IDEA_DRAFT, businessImpactId: 'impact-from-org-b' },
      }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.draft.businessImpactId).toBeNull()
  })

  it('falls back to the draft’s earlier value rather than erasing it', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        draft: { ...EMPTY_IDEA_DRAFT, ideaTypeId: 'type-from-org-b' },
      }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: { ...EMPTY_IDEA_DRAFT, ideaTypeId: TYPE_A },
    })

    expect(result.draft.ideaTypeId).toBe(TYPE_A)
  })

  it('keeps an id that IS in the retrieved set', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        draft: { ...EMPTY_IDEA_DRAFT, ideaTypeId: TYPE_A, businessImpactId: IMPACT_A },
      }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.draft.ideaTypeId).toBe(TYPE_A)
    expect(result.draft.businessImpactId).toBe(IMPACT_A)
  })

  it('drops an id that is no longer active in the organization', async () => {
    // An archived option is simply absent from the retrieved context, which is what makes the
    // schema's closed enum and this re-check agree.
    const { service } = harness({
      currentUser: member(ORG_A),
      context: context({ ideaTypes: [] }),
      response: modelResponse({ draft: { ...EMPTY_IDEA_DRAFT, ideaTypeId: TYPE_A } }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.draft.ideaTypeId).toBeNull()
  })

  it('drops a priority that is not a real Priority member', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        draft: { ...EMPTY_IDEA_DRAFT, priority: 'Catastrophic' as Priority },
      }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.draft.priority).toBeNull()
  })
})

describe('IdeaAssistService authorization', () => {
  it('refuses Read Only', async () => {
    const { service, reservations } = harness({ currentUser: readOnly(ORG_A) })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null }),
    ).rejects.toThrow(ForbiddenError)
    expect(reservations).toHaveLength(0)
  })

  it('refuses a direct Site Admin - drafting is organization work reached through View As', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('reports a board in another organization as not-found', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [{ id: BOARD_B, organizationId: ORG_B }],
    })

    await expect(
      service.continueTurn({ boardId: BOARD_B, transcript: [USER_TURN], draft: null }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('builds the context from the caller’s own organization, never a request field', async () => {
    const { service, modelCalls } = harness({ currentUser: member(ORG_A) })

    await service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })

    expect(modelCalls[0]?.context.organizationId).toBe(ORG_A)
  })

  it('attributes usage to the impersonated user’s organization during View As (rule 28c)', async () => {
    const { service, reservations } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })

    expect(reservations[0]?.organizationId).toBe(ORG_A)
  })
})

describe('IdeaAssistService transcript caps', () => {
  it('rejects an empty transcript', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [], draft: null }),
    ).rejects.toThrow(ValidationError)
  })

  it(`rejects more than ${MAX_TRANSCRIPT_ENTRIES} entries`, async () => {
    const transcript = Array.from({ length: MAX_TRANSCRIPT_ENTRIES + 1 }, () => USER_TURN)
    const { service } = harness({ currentUser: member(ORG_A) })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript, draft: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects an entry longer than the per-entry cap', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    await expect(
      service.continueTurn({
        boardId: BOARD_A,
        transcript: [{ role: 'user', text: 'x'.repeat(TRANSCRIPT_ENTRY_MAX_LENGTH + 1) }],
        draft: null,
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a transcript that does not end with a user entry', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    await expect(
      service.continueTurn({
        boardId: BOARD_A,
        transcript: [USER_TURN, { role: 'assistant', text: 'A question' }],
        draft: null,
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('forwards the TRIMMED text, so padding cannot buy billed tokens past the cap', async () => {
    const padded = `${'x'.repeat(10)}${' '.repeat(50_000)}`
    const { service, modelCalls } = harness({ currentUser: member(ORG_A) })

    await service.continueTurn({
      boardId: BOARD_A,
      transcript: [{ role: 'user', text: padded }],
      draft: null,
    })

    expect(modelCalls[0]?.transcript[0]?.text).toBe('x'.repeat(10))
  })

  it('reports the remaining user turns, reaching zero at the cap', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    const early = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })
    expect(early.turnsRemaining).toBe(9)
    expect(early.conversationClosed).toBe(false)

    const last = await service.continueTurn({
      boardId: BOARD_A,
      transcript: Array.from({ length: 19 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        text: 'x',
      })),
      draft: null,
    })
    expect(last.turnsRemaining).toBe(0)
    expect(last.conversationClosed).toBe(true)
  })
})

describe('IdeaAssistService degradation', () => {
  it('answers unavailable when no key is configured, and reserves nothing beyond the estimate', async () => {
    const { service, settlements } = harness({ currentUser: member(ORG_A), isConfigured: false })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null }),
    ).rejects.toThrow(AiAssistUnavailableError)

    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Failed)
    expect(settlements[0]?.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    })
  })

  it('answers unavailable when the daily budget is exhausted, indistinguishably from an unconfigured key', async () => {
    const unconfigured = harness({ currentUser: member(ORG_A), isConfigured: false })
    const exhausted = harness({ currentUser: member(ORG_A), withinBudget: false })

    const a = await unconfigured.service
      .continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })
      .catch((error: Error) => error)
    const b = await exhausted.service
      .continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })
      .catch((error: Error) => error)

    expect((a as Error).constructor).toBe((b as Error).constructor)
    expect((a as Error).message).toBe((b as Error).message)
  })

  it('never calls the provider once the budget is exhausted - the point of the gate is to not spend', async () => {
    const { service, modelCalls } = harness({ currentUser: member(ORG_A), withinBudget: false })

    await service
      .continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })
      .catch(() => undefined)

    expect(modelCalls).toHaveLength(0)
  })

  it('reserves BEFORE the gates, so a concurrent turn can see this one', async () => {
    const { service, reservations } = harness({ currentUser: member(ORG_A), withinBudget: false })

    await service
      .continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })
      .catch(() => undefined)

    expect(reservations).toHaveLength(1)
  })

  it('surfaces a rate limit as its own error, not folded into the 503', async () => {
    const rateLimitError = new Error('too many')
    const { service } = harness({ currentUser: member(ORG_A), rateLimitError })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null }),
    ).rejects.toBe(rateLimitError)
  })

  it('meters a provider failure at the counts it reported, then degrades', async () => {
    const billed: AiTokenUsage = {
      inputTokens: 900,
      outputTokens: 50,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    }
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      modelError: new IdeaDraftModelError('refused', { usage: billed }),
    })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null }),
    ).rejects.toThrow(AiAssistUnavailableError)

    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Failed)
    expect(settlements[0]?.usage).toEqual(billed)
  })

  it('leaves the reservation standing when the provider reported nothing', async () => {
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      modelError: new IdeaDraftModelError('timeout'),
    })

    await service
      .continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })
      .catch(() => undefined)

    expect(settlements[0]?.usage).toBeNull()
  })

  it('lets a non-port error propagate as the defect it is, and does not zero the reservation', async () => {
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      modelError: new TypeError('provider adapter is broken'),
    })

    await expect(
      service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null }),
    ).rejects.toThrow(TypeError)

    expect(settlements).toHaveLength(0)
  })
})

describe('IdeaAssistService scope gate', () => {
  it('returns the redirect, leaves the draft unchanged, and does not spend a conversation turn', async () => {
    const currentDraft: IdeaDraft = { ...EMPTY_IDEA_DRAFT, title: 'Existing title' }
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        inScope: false,
        draft: { ...EMPTY_IDEA_DRAFT, title: 'Hijacked' },
      }),
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: currentDraft,
    })

    expect(result.inScope).toBe(false)
    expect(result.nextQuestion).toBe('Let us stay on ideas.')
    expect(result.draft).toEqual(currentDraft)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Refused)
  })

  it('closes the conversation on the third consecutive refusal, read from the usage rows', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false }),
      recentOutcomes: [AiCallOutcome.Refused, AiCallOutcome.Refused, AiCallOutcome.Refused],
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.conversationClosed).toBe(true)
    expect(result.nextQuestion).toBe('This conversation is closed.')
  })

  it('does not close on two refusals with a success between them', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false }),
      recentOutcomes: [AiCallOutcome.Refused, AiCallOutcome.Succeeded, AiCallOutcome.Refused],
    })

    const result = await service.continueTurn({
      boardId: BOARD_A,
      transcript: [USER_TURN],
      draft: null,
    })

    expect(result.conversationClosed).toBe(false)
  })

  it('meters a refusal - a cap that counts only successes does not bound spend', async () => {
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false, inputTokens: 800, outputTokens: 40 }),
    })

    await service.continueTurn({ boardId: BOARD_A, transcript: [USER_TURN], draft: null })

    expect(settlements[0]?.usage).toMatchObject({ inputTokens: 800, outputTokens: 40 })
  })
})

describe('IdeaAssistService audit', () => {
  it('records the outcome without the prompt or the transcript (rule 27)', async () => {
    const secret = 'a phrase that must never appear in the audit log'
    const { service, audit } = harness({ currentUser: member(ORG_A) })

    await service.continueTurn({
      boardId: BOARD_A,
      transcript: [{ role: 'user', text: secret }],
      draft: null,
    })

    const serialized = JSON.stringify(audit.events)
    expect(serialized).not.toContain(secret)
    expect(audit.events[0]).toMatchObject({ eventType: 'IdeaAssistTurn', organizationId: ORG_A })
    expect(audit.events[0]?.metadataJson).toContain('"turnCount":1')
  })
})

describe('IdeaAssistService scope statement', () => {
  function organization(id: string): Organization {
    return createOrganization(
      {
        id,
        title: 'Acme',
        description: 'A description',
        inviteCode: 'CODE',
        profile: {
          address: null,
          city: null,
          state: null,
          zip: null,
          phone: null,
          primaryContactFirstName: null,
          primaryContactLastName: null,
        },
      },
      NOW,
      'seed',
    )
  }

  it('lets a direct Site Admin READ an organization’s settings', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      organizations: [organization(ORG_B)],
    })

    await expect(service.getSettings(ORG_B)).resolves.toMatchObject({ aiAssistAvailable: true })
  })

  it('refuses a direct Site Admin WRITING one - it is organization content (rule 25)', async () => {
    const { service, updatedOrganizations } = harness({
      currentUser: siteAdmin(),
      organizations: [organization(ORG_A)],
    })

    await expect(service.setScopeStatement(ORG_A, 'Only supply chain')).rejects.toThrow(
      ForbiddenError,
    )
    expect(updatedOrganizations).toHaveLength(0)
  })

  it('refuses an Org Admin another organization’s settings, as not-found', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_B)],
    })

    await expect(service.getSettings(ORG_B)).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s the settings entirely', async (_label, currentUser) => {
    const { service } = harness({ currentUser, organizations: [organization(ORG_A)] })

    await expect(service.getSettings(ORG_A)).rejects.toThrow(ForbiddenError)
  })

  it('rejects a scope statement over the domain maximum', async () => {
    const { service, updatedOrganizations } = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_A)],
    })

    await expect(service.setScopeStatement(ORG_A, 'x'.repeat(501))).rejects.toThrow(ValidationError)
    expect(updatedOrganizations).toHaveLength(0)
  })

  it('never reports the API key itself, only whether one is configured (rule 28)', async () => {
    const configured = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_A)],
    })
    const dark = harness({
      currentUser: orgAdmin(ORG_A),
      organizations: [organization(ORG_A)],
      isConfigured: false,
    })

    await expect(configured.service.getSettings(ORG_A)).resolves.toEqual({
      aiAssistAvailable: true,
      scopeStatement: null,
    })
    await expect(dark.service.getSettings(ORG_A)).resolves.toEqual({
      aiAssistAvailable: false,
      scopeStatement: null,
    })
  })
})
