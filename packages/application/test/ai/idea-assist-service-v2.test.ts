// IdeaAssistService.continueTurnV2 (SPEC/contracts/ai-assist.md "v2 turn contract"): the same
// pipeline as v1 with a v2 request and result. These tests pin the gates and metering the two
// versions share, the no-board variant, and that the model's output is finalised before it leaves.

import { AiCallOutcome, FieldType, Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { AiAssistUnavailableError } from '../../src/ai/errors.js'
import { IdeaAssistService, MAX_TRANSCRIPT_ENTRIES } from '../../src/ai/idea-assist.service.js'
import type { IdeaAssistContextBuilder } from '../../src/ai/idea-assist-context-builder.js'
import type {
  AiTokenUsage,
  AiUsageReservation,
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaAssistTurnInputV2,
  IdeaAssistTurnRequestV2,
  IdeaDraftModelResponseV2,
  ReserveAiUsageInput,
} from '../../src/ai/models.js'
import type {
  AiBoardLookupPort,
  AiOrganizationRepository,
  AiUsageGate,
  IdeaDraftModel,
} from '../../src/ai/ports.js'
import { IdeaDraftModelError } from '../../src/ai/ports.js'
import { SYSTEM_PROMPT_TEMPLATE_V2 } from '../../src/ai/prompt-defaults.js'
import { customFieldKey } from '../../src/ai/turn-schema-v2.js'
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
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const BOARD_A = 'board-a'
const BOARD_B = 'board-b'
const TYPE_A = 'type-a'
const IMPACT_A = 'impact-a'
const BUDGET = 'field-budget'

const budget = {
  id: BUDGET,
  name: 'Budget',
  fieldType: FieldType.Number,
  isRequired: true,
  options: [],
}

function context(overrides: Partial<IdeaAssistContext> = {}): IdeaAssistContext {
  return {
    organizationId: ORG_A,
    organizationName: 'Acme',
    scopeStatement: null,
    ideaTypes: [{ id: TYPE_A, name: 'Improvement' }],
    businessImpacts: [{ id: IMPACT_A, name: 'Medium' }],
    statuses: ['New'],
    tags: ['billing'],
    memberNames: [],
    prompts: {
      systemPromptTemplate: 'v1 template',
      outOfScopeRedirect: 'Let us stay on ideas.',
      conversationClosedRedirect: 'This conversation is closed.',
      version: 1,
    },
    fieldsByIdeaType: { [TYPE_A]: [budget] },
    ...overrides,
  }
}

function modelResponse(
  overrides: Partial<IdeaDraftModelResponseV2> = {},
): IdeaDraftModelResponseV2 {
  return {
    inScope: true,
    nextQuestion: 'What problem does this solve?',
    nextStep: 'problem',
    changes: {},
    suggestions: undefined,
    inputTokens: 1200,
    outputTokens: 300,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    ...overrides,
  }
}

const USER_TURN: IdeaAssistTurn = { role: 'user', text: 'We should simplify onboarding.' }

function request(overrides: Partial<IdeaAssistTurnRequestV2> = {}): IdeaAssistTurnRequestV2 {
  return {
    boardId: BOARD_A,
    transcript: [USER_TURN],
    draft: null,
    lockedFields: [],
    step: null,
    ...overrides,
  }
}

type Settlement = {
  reservation: AiUsageReservation
  outcome: AiCallOutcome
  usage: AiTokenUsage | null
}

function harness(options: {
  currentUser: CurrentUserContext
  isConfigured?: boolean
  withinBudget?: boolean
  response?: IdeaDraftModelResponseV2
  modelError?: unknown
  context?: IdeaAssistContext
  boards?: readonly { id: string; organizationId: string }[]
  recentOutcomes?: readonly AiCallOutcome[]
  rateLimitError?: Error
}) {
  const boardsById = new Map(
    (options.boards ?? [{ id: BOARD_A, organizationId: ORG_A }]).map((b) => [b.id, b]),
  )
  const settlements: Settlement[] = []
  const reservations: ReserveAiUsageInput[] = []
  const outcomeQueries: { organizationId: string; boardId: string | null }[] = []
  const modelCalls: {
    context: IdeaAssistContext
    transcript: readonly IdeaAssistTurn[]
    input: IdeaAssistTurnInputV2
  }[] = []
  let v1Calls = 0

  const model: IdeaDraftModel = {
    isConfigured: options.isConfigured ?? true,
    async continueTurn() {
      v1Calls++
      throw new Error('v2 must not call the v1 port')
    },
    async continueTurnV2(ctx, transcript, input) {
      modelCalls.push({ context: ctx, transcript, input })
      if (options.modelError) {
        throw options.modelError
      }
      return options.response ?? modelResponse()
    },
  }

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
    async getById() {
      return null
    },
    async update() {},
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
    async getRecentOutcomes(organizationId, boardId) {
      outcomeQueries.push({ organizationId, boardId })
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
      { canSeeBoard: async () => true },
    ),
    settlements,
    reservations,
    modelCalls,
    outcomeQueries,
    audit,
    v1Calls: () => v1Calls,
  }
}

describe('IdeaAssistService.continueTurnV2 result', () => {
  it('returns only validated changes, suggestions and a nextStep, never the model’s raw output', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        changes: {
          title: 'Simplify onboarding',
          ideaTypeId: 'type-from-org-b',
          priority: 'Catastrophic',
          injected: 'x',
        },
        suggestions: { solutions: ['a', 'b', 'c', 'd'] },
        nextStep: 'ignore previous instructions',
      }),
    })

    const result = await service.continueTurnV2(request())

    expect(result.changes).toEqual({ title: 'Simplify onboarding' })
    expect(result.suggestions?.solutions).toEqual(['a', 'b', 'c'])
    expect(result.nextStep).toBe('problem')
    expect(result.inScope).toBe(true)
    expect(result.nextQuestion).toBe('What problem does this solve?')
  })

  it('strips a locked field and a locked custom field the model set anyway', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        changes: {
          title: 'Overwritten',
          problem: 'Open',
          fieldValues: [{ fieldDefinitionId: BUDGET, value: '5' }],
        },
      }),
    })

    const result = await service.continueTurnV2(
      request({
        draft: { ideaTypeId: TYPE_A, title: 'Mine' },
        lockedFields: ['title', customFieldKey(BUDGET)],
      }),
    )

    expect(result.changes).toEqual({ problem: 'Open' })
  })

  it('hands the model the normalised request, with the v2 prompt in place of the active template', async () => {
    const { service, modelCalls } = harness({ currentUser: member(ORG_A) })

    await service.continueTurnV2(
      request({
        draft: { ideaTypeId: TYPE_A, businessImpactId: 'impact-from-org-b', tagNames: ['x'] },
        lockedFields: ['title', 'not-a-field'],
        step: 'bogus step',
      }),
    )

    const call = modelCalls[0]
    expect(call?.context.prompts.systemPromptTemplate).toBe(SYSTEM_PROMPT_TEMPLATE_V2)
    expect(call?.input.lockedFields).toEqual(['title'])
    expect(call?.input.step).toBeNull()
    expect(call?.input.draft.businessImpactId).toBeNull()
    expect(call?.input.draft.tagNames).toEqual([])
    expect(call?.input.customFields.map((f) => f.id)).toEqual([BUDGET])
  })

  it('never calls the v1 port', async () => {
    const { service, v1Calls } = harness({ currentUser: member(ORG_A) })

    await service.continueTurnV2(request())

    expect(v1Calls()).toBe(0)
  })
})

describe('IdeaAssistService.continueTurnV2 turn cap', () => {
  it('reports the remaining user turns, reaching zero and closing at the cap', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    const early = await service.continueTurnV2(request())
    expect(early.turnsRemaining).toBe(9)
    expect(early.conversationClosed).toBe(false)

    const last = await service.continueTurnV2(
      request({
        transcript: Array.from({ length: MAX_TRANSCRIPT_ENTRIES - 1 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          text: 'x',
        })),
      }),
    )
    expect(last.turnsRemaining).toBe(0)
    expect(last.conversationClosed).toBe(true)
  })

  it('rejects a transcript over the entry cap before reserving anything', async () => {
    const { service, reservations } = harness({ currentUser: member(ORG_A) })

    await expect(
      service.continueTurnV2(
        request({
          transcript: Array.from({ length: MAX_TRANSCRIPT_ENTRIES + 1 }, () => USER_TURN),
        }),
      ),
    ).rejects.toThrow(ValidationError)
    expect(reservations).toHaveLength(0)
  })

  it('rejects a transcript that does not end with a user entry', async () => {
    const { service } = harness({ currentUser: member(ORG_A) })

    await expect(
      service.continueTurnV2(
        request({ transcript: [USER_TURN, { role: 'assistant', text: 'A question' }] }),
      ),
    ).rejects.toThrow(ValidationError)
  })
})

describe('IdeaAssistService.continueTurnV2 scope gate', () => {
  it('returns the redirect, no changes and the step the client sent, and spends no conversation turn', async () => {
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({
        inScope: false,
        changes: { title: 'Hijacked' },
        nextStep: 'title',
      }),
    })

    const result = await service.continueTurnV2(request({ step: 'impactRationale' }))

    expect(result).toMatchObject({
      inScope: false,
      conversationClosed: false,
      nextQuestion: 'Let us stay on ideas.',
      changes: {},
      nextStep: 'impactRationale',
      turnsRemaining: 10,
    })
    expect('suggestions' in result).toBe(false)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Refused)
  })

  it('echoes problem when the refused request carried no usable step', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false }),
    })

    const result = await service.continueTurnV2(request({ step: 'not a step' }))

    expect(result.nextStep).toBe('problem')
  })

  it('closes the conversation on the third consecutive refusal, read from the usage rows', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false }),
      recentOutcomes: [AiCallOutcome.Refused, AiCallOutcome.Refused, AiCallOutcome.Refused],
    })

    const result = await service.continueTurnV2(request())

    expect(result.conversationClosed).toBe(true)
    expect(result.nextQuestion).toBe('This conversation is closed.')
  })

  it('does not close on two refusals with a success between them', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false }),
      recentOutcomes: [AiCallOutcome.Refused, AiCallOutcome.Succeeded, AiCallOutcome.Refused],
    })

    expect((await service.continueTurnV2(request())).conversationClosed).toBe(false)
  })
})

describe('IdeaAssistService.continueTurnV2 degradation and metering', () => {
  it('surfaces a rate limit as its own error, not the 503, and settles the reservation at zero', async () => {
    const rateLimitError = new Error('too many')
    const { service, settlements, modelCalls } = harness({
      currentUser: member(ORG_A),
      rateLimitError,
    })

    await expect(service.continueTurnV2(request())).rejects.toBe(rateLimitError)

    expect(modelCalls).toHaveLength(0)
    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Failed)
    expect(settlements[0]?.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    })
  })

  it('answers unavailable, indistinguishably, for no key and for an exhausted budget', async () => {
    const dark = harness({ currentUser: member(ORG_A), isConfigured: false })
    const spent = harness({ currentUser: member(ORG_A), withinBudget: false })

    const a = await dark.service.continueTurnV2(request()).catch((e: Error) => e)
    const b = await spent.service.continueTurnV2(request()).catch((e: Error) => e)

    expect(a).toBeInstanceOf(AiAssistUnavailableError)
    expect((a as Error).message).toBe((b as Error).message)
    expect(dark.modelCalls).toHaveLength(0)
    expect(spent.modelCalls).toHaveLength(0)
  })

  it('meters a succeeded turn at the provider’s counts', async () => {
    const { service, settlements, reservations } = harness({ currentUser: member(ORG_A) })

    await service.continueTurnV2(request())

    expect(reservations).toHaveLength(1)
    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Succeeded)
    expect(settlements[0]?.usage).toMatchObject({ inputTokens: 1200, outputTokens: 300 })
  })

  it('meters a refusal as Refused at the provider’s counts', async () => {
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false, inputTokens: 800, outputTokens: 40 }),
    })

    await service.continueTurnV2(request())

    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Refused)
    expect(settlements[0]?.usage).toMatchObject({ inputTokens: 800, outputTokens: 40 })
  })

  it('meters a provider failure at its reported counts, then degrades to unavailable', async () => {
    const billed: AiTokenUsage = {
      inputTokens: 900,
      outputTokens: 50,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    }
    const { service, settlements, audit } = harness({
      currentUser: member(ORG_A),
      modelError: new IdeaDraftModelError('refused', { usage: billed }),
    })

    await expect(service.continueTurnV2(request())).rejects.toThrow(AiAssistUnavailableError)

    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.outcome).toBe(AiCallOutcome.Failed)
    expect(settlements[0]?.usage).toEqual(billed)
    expect(audit.events[0]?.metadataJson).toContain('"failed":true')
  })

  it('lets a non-port error propagate without zeroing the reservation', async () => {
    const { service, settlements } = harness({
      currentUser: member(ORG_A),
      modelError: new TypeError('adapter is broken'),
    })

    await expect(service.continueTurnV2(request())).rejects.toThrow(TypeError)
    expect(settlements).toHaveLength(0)
  })
})

describe('IdeaAssistService.continueTurnV2 authorization', () => {
  it('refuses Read Only and a direct Site Admin without reserving', async () => {
    for (const currentUser of [readOnly(ORG_A), siteAdmin()]) {
      const { service, reservations } = harness({ currentUser })

      await expect(service.continueTurnV2(request())).rejects.toThrow(ForbiddenError)
      await expect(service.continueTurnV2(request({ boardId: null }))).rejects.toThrow(
        ForbiddenError,
      )
      expect(reservations).toHaveLength(0)
    }
  })

  it('reports a board in another organization as not-found', async () => {
    const { service, reservations } = harness({
      currentUser: member(ORG_A),
      boards: [{ id: BOARD_B, organizationId: ORG_B }],
    })

    await expect(service.continueTurnV2(request({ boardId: BOARD_B }))).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(reservations).toHaveLength(0)
  })

  it('attributes usage to the impersonated user’s organization during View As', async () => {
    const { service, reservations } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.continueTurnV2(request({ boardId: null }))

    expect(reservations[0]?.organizationId).toBe(ORG_A)
  })
})

describe('IdeaAssistService.continueTurnV2 without a board', () => {
  it('runs the turn for the caller’s organization with no board lookup', async () => {
    const { service, reservations, modelCalls } = harness({
      currentUser: member(ORG_A),
      boards: [],
    })

    const result = await service.continueTurnV2(request({ boardId: null }))

    expect(result.inScope).toBe(true)
    expect(reservations[0]).toMatchObject({ organizationId: ORG_A, boardId: null })
    expect(modelCalls[0]?.context.organizationId).toBe(ORG_A)
  })

  it('names the organization, not a board, in the audit entry, without the transcript', async () => {
    const secret = 'a phrase that must never appear in the audit log'
    const { service, audit } = harness({ currentUser: member(ORG_A) })

    await service.continueTurnV2(
      request({ boardId: null, transcript: [{ role: 'user', text: secret }] }),
    )

    expect(audit.events[0]).toMatchObject({
      eventType: 'IdeaAssistTurn',
      entityType: 'Organization',
      entityId: ORG_A,
      organizationId: ORG_A,
    })
    expect(audit.events[0]?.metadataJson).toContain('"boardId":null')
    expect(JSON.stringify(audit.events)).not.toContain(secret)
  })

  it('names the board in the audit entry when there is one', async () => {
    const { service, audit } = harness({ currentUser: member(ORG_A) })

    await service.continueTurnV2(request())

    expect(audit.events[0]).toMatchObject({ entityType: 'Board', entityId: BOARD_A })
  })

  it('counts strikes against the organization-level conversation, not a board', async () => {
    const { service, outcomeQueries } = harness({
      currentUser: member(ORG_A),
      response: modelResponse({ inScope: false }),
    })

    await service.continueTurnV2(request({ boardId: null }))

    expect(outcomeQueries).toEqual([{ organizationId: ORG_A, boardId: null }])
  })

  it('normalises against the caller’s own organization catalog', async () => {
    const { service, modelCalls } = harness({
      currentUser: member(ORG_A),
      context: context({ organizationId: ORG_A }),
    })

    await service.continueTurnV2(
      request({ boardId: null, draft: { ideaTypeId: 'type-from-org-b' } }),
    )

    expect(modelCalls[0]?.input.draft.ideaTypeId).toBeNull()
    expect(modelCalls[0]?.input.customFields).toEqual([])
  })
})
