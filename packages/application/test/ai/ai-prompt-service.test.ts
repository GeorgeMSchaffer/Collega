// Idea-assist prompt administration (SPEC/20-feature-ai-idea-assist.md rules 34-38) and the
// notification writer.
//
// AiPromptService is the mirror image of every other service in this package: the prompt is
// DEPLOYMENT configuration, not organization content, so it is Site-Admin-only and deliberately
// reads the EFFECTIVE role - which means a Site Admin inside a View As session is refused. That
// asymmetry is easy to "fix" into a hole, so it gets its own test.

import type { AiPromptVersion } from '@collega/domain/ai'
import { ORGANIZATION_CATALOG_PLACEHOLDER, SCOPE_STATEMENT_PLACEHOLDER } from '@collega/domain/ai'
import { NotificationEventType, Role } from '@collega/domain/enums'
import type { NotificationEvent } from '@collega/domain/notifications'
import { describe, expect, it } from 'vitest'
import { AiPromptService } from '../../src/ai/ai-prompt.service.js'
import { AiAssistUnavailableError } from '../../src/ai/errors.js'
import type { IdeaAssistContext, IdeaDraftModelResponse } from '../../src/ai/models.js'
import type {
  AiPromptVersionRepository,
  AiUsageGate,
  AiUsersPort,
  IdeaDraftModel,
} from '../../src/ai/ports.js'
import { IdeaDraftModelError } from '../../src/ai/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import { NotificationService } from '../../src/notifications/notification.service.js'
import type { NotificationEventRepository } from '../../src/notifications/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const VALID_BODY = `You help draft ideas. ${ORGANIZATION_CATALOG_PLACEHOLDER} ${SCOPE_STATEMENT_PLACEHOLDER}`

function version(overrides: Partial<AiPromptVersion> = {}): AiPromptVersion {
  return {
    id: 'version-1',
    version: 1,
    body: VALID_BODY,
    outOfScopeRedirect: 'Back to ideas, please.',
    conversationClosedRedirect: 'This conversation is closed.',
    isActive: true,
    createdAtUtc: NOW,
    createdByUserId: 'sa-9',
    ...overrides,
  }
}

function harness(options: {
  currentUser: CurrentUserContext
  versions?: readonly AiPromptVersion[]
  isConfigured?: boolean
  withinBudget?: boolean
  probeResponses?: readonly IdeaDraftModelResponse[]
  probeError?: unknown
}) {
  const stored = [...(options.versions ?? [])]
  const added: AiPromptVersion[] = []
  let deactivations = 0
  const probeContexts: IdeaAssistContext[] = []

  const versions: AiPromptVersionRepository = {
    async getActive() {
      return stored.find((v) => v.isActive) ?? null
    },
    async list() {
      return [...stored].sort((a, b) => b.version - a.version)
    },
    async getByVersion(v) {
      return stored.find((s) => s.version === v) ?? null
    },
    async getMaxVersion() {
      return stored.reduce((max, v) => Math.max(max, v.version), 0)
    },
    async add(v) {
      added.push(v)
      stored.push(v)
    },
    async deactivateAll() {
      deactivations++
      for (let i = 0; i < stored.length; i++) {
        stored[i] = { ...(stored[i] as AiPromptVersion), isActive: false }
      }
    },
  }

  let probeIndex = 0
  const model: IdeaDraftModel = {
    isConfigured: options.isConfigured ?? true,
    async continueTurn(context) {
      probeContexts.push(context)
      if (options.probeError) {
        throw options.probeError
      }
      const response = options.probeResponses?.[probeIndex++]
      return (
        response ?? {
          inScope: false,
          nextQuestion: 'Back to ideas, please.',
          draft: {
            title: null,
            description: null,
            ideaTypeId: null,
            businessImpactId: null,
            priority: null,
          },
          inputTokens: 100,
          outputTokens: 10,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        }
      )
    },
  }

  const usage = {
    async isWithinDailyBudget() {
      return options.withinBudget ?? true
    },
  } as AiUsageGate

  const users: AiUsersPort = {
    async getDisplayNames(ids) {
      return new Map(ids.map((id) => [id, `Name ${id}`]))
    },
  }

  const audit = recordingAudit()

  return {
    service: new AiPromptService(
      versions,
      model,
      usage,
      users,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    added,
    audit,
    probeContexts,
    deactivations: () => deactivations,
  }
}

describe('AiPromptService authorization', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s every prompt operation', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.get()).rejects.toThrow(ForbiddenError)
    await expect(
      service.publish({
        body: VALID_BODY,
        outOfScopeRedirect: 'a',
        conversationClosedRedirect: 'b',
      }),
    ).rejects.toThrow(ForbiddenError)
    await expect(service.resetToDefault()).rejects.toThrow(ForbiddenError)
    await expect(service.probe(VALID_BODY)).rejects.toThrow(ForbiddenError)
  })

  it('refuses a Site Admin INSIDE a View As session - the effective role is the target’s', async () => {
    // Deployment configuration must not be editable from inside an impersonation session. This
    // reads `currentUser.role` rather than the real user's role on purpose.
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await expect(
      service.publish({
        body: VALID_BODY,
        outOfScopeRedirect: 'a',
        conversationClosedRedirect: 'b',
      }),
    ).rejects.toThrow(ForbiddenError)
    expect(added).toHaveLength(0)
  })

  it('lets a direct Site Admin publish', async () => {
    const { service, added } = harness({ currentUser: siteAdmin() })

    await service.publish({
      body: VALID_BODY,
      outOfScopeRedirect: 'a',
      conversationClosedRedirect: 'b',
    })

    expect(added).toHaveLength(1)
  })
})

describe('AiPromptService versioning', () => {
  it('reports the built-in default when nothing is published', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    const settings = await service.get()

    expect(settings.isBuiltInDefault).toBe(true)
    expect(settings.versions).toEqual([])
  })

  it('issues the next version number and stands down the previous one', async () => {
    const { service, added, deactivations } = harness({
      currentUser: siteAdmin(),
      versions: [version({ version: 3 })],
    })

    await service.publish({
      body: VALID_BODY,
      outOfScopeRedirect: 'a',
      conversationClosedRedirect: 'b',
    })

    expect(added[0]?.version).toBe(4)
    expect(deactivations()).toBe(1)
  })

  it('rejects a body missing either required placeholder', async () => {
    const { service, added } = harness({ currentUser: siteAdmin() })

    await expect(
      service.publish({
        body: `no placeholders here ${SCOPE_STATEMENT_PLACEHOLDER}`,
        outOfScopeRedirect: 'a',
        conversationClosedRedirect: 'b',
      }),
    ).rejects.toThrow(ValidationError)
    await expect(
      service.publish({
        body: `only catalog ${ORGANIZATION_CATALOG_PLACEHOLDER}`,
        outOfScopeRedirect: 'a',
        conversationClosedRedirect: 'b',
      }),
    ).rejects.toThrow(ValidationError)
    expect(added).toHaveLength(0)
  })

  it('restores an earlier version as a NEW version, keeping history append-only', async () => {
    const { service, added } = harness({
      currentUser: siteAdmin(),
      versions: [
        version({ version: 1, body: VALID_BODY, isActive: false }),
        version({ version: 2 }),
      ],
    })

    await service.restore(1)

    expect(added[0]?.version).toBe(3)
    expect(added[0]?.body).toBe(VALID_BODY)
  })

  it('reports an unknown version as not-found', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(service.restore(99)).rejects.toThrow(NotFoundError)
  })

  it('resets to the built-in default by deactivating rather than deleting', async () => {
    const { service, added, deactivations } = harness({
      currentUser: siteAdmin(),
      versions: [version()],
    })

    const settings = await service.resetToDefault()

    expect(deactivations()).toBe(1)
    expect(added).toHaveLength(0)
    expect(settings.isBuiltInDefault).toBe(true)
    expect(settings.versions).toHaveLength(1)
  })

  it('records the version number in the audit event and never the body (rule 27)', async () => {
    const marker = 'A SECRET INSTRUCTION'
    const { service, audit } = harness({ currentUser: siteAdmin() })

    await service.publish({
      body: `${marker} ${ORGANIZATION_CATALOG_PLACEHOLDER} ${SCOPE_STATEMENT_PLACEHOLDER}`,
      outOfScopeRedirect: 'a',
      conversationClosedRedirect: 'b',
    })

    expect(JSON.stringify(audit.events)).not.toContain(marker)
    expect(audit.events[0]?.metadataJson).toBe('{"version":1}')
  })

  it('attributes the publish to the real administrator even if a session were somehow live', async () => {
    const { service, added } = harness({ currentUser: siteAdmin('sa-9') })

    await service.publish({
      body: VALID_BODY,
      outOfScopeRedirect: 'a',
      conversationClosedRedirect: 'b',
    })

    expect(added[0]?.createdByUserId).toBe('sa-9')
  })
})

describe('AiPromptService.probe', () => {
  it('refuses to probe a draft that could never be published', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(service.probe('no placeholders')).rejects.toThrow(ValidationError)
  })

  it('probes against a synthetic catalog, never a real organization’s', async () => {
    const { service, probeContexts } = harness({ currentUser: siteAdmin() })

    await service.probe(VALID_BODY)

    expect(probeContexts).toHaveLength(3)
    expect(new Set(probeContexts.map((c) => c.organizationName))).toEqual(
      new Set(['Probe Organization']),
    )
  })

  it('reports each probe as refused when the model declines it', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    const report = await service.probe(VALID_BODY)

    expect(report.probes).toHaveLength(3)
    expect(report.probes.every((p) => p.refused && p.expectedRefused)).toBe(true)
  })

  it('reports a probe the model ANSWERED as not refused', async () => {
    const answered: IdeaDraftModelResponse = {
      inScope: true,
      nextQuestion: 'Here is a limerick',
      draft: {
        title: null,
        description: null,
        ideaTypeId: null,
        businessImpactId: null,
        priority: null,
      },
      inputTokens: 10,
      outputTokens: 10,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    }
    const { service } = harness({ currentUser: siteAdmin(), probeResponses: [answered] })

    const report = await service.probe(VALID_BODY)

    expect(report.probes[0]?.refused).toBe(false)
  })

  it('reports a provider failure as unavailable, never as a passed probe', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      probeError: new IdeaDraftModelError('provider down'),
    })

    await expect(service.probe(VALID_BODY)).rejects.toThrow(AiAssistUnavailableError)
  })

  it('refuses to probe with no key configured, or with the daily budget exhausted', async () => {
    const dark = harness({ currentUser: siteAdmin(), isConfigured: false })
    const spent = harness({ currentUser: siteAdmin(), withinBudget: false })

    await expect(dark.service.probe(VALID_BODY)).rejects.toThrow(AiAssistUnavailableError)
    await expect(spent.service.probe(VALID_BODY)).rejects.toThrow(AiAssistUnavailableError)
    expect(dark.probeContexts).toHaveLength(0)
    expect(spent.probeContexts).toHaveLength(0)
  })
})

// Notifications ----------------------------------------------------------------------------------

describe('NotificationService', () => {
  function notificationHarness() {
    const written: NotificationEvent[] = []
    const repository: NotificationEventRepository = {
      async add(event) {
        written.push(event)
      },
    }
    return { service: new NotificationService(repository, fixedClock()), written }
  }

  const input = {
    eventType: NotificationEventType.CommentAdded,
    organizationId: ORG_A,
    boardId: 'board-a',
    ideaId: 'idea-1',
    ideaTitle: 'An idea',
    actorUserId: 'actor-1',
    recipientUserId: 'recipient-1',
  }

  it('writes one event per recipient, stamped from the injected clock', async () => {
    const { service, written } = notificationHarness()

    await service.notify(input)

    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ recipientUserId: 'recipient-1', organizationId: ORG_A })
    expect(written[0]?.occurredAtUtc).toEqual(NOW)
  })

  it('suppresses a self-notification', async () => {
    const { service, written } = notificationHarness()

    await service.notify({ ...input, recipientUserId: 'actor-1' })

    expect(written).toHaveLength(0)
  })

  it('suppresses an empty recipient rather than writing an unaddressed row', async () => {
    const { service, written } = notificationHarness()

    await service.notify({ ...input, recipientUserId: '' })

    expect(written).toHaveLength(0)
  })

  it('records the canonical idea link on the row', async () => {
    const { service, written } = notificationHarness()

    await service.notify(input)

    expect(written[0]?.link).toContain('idea-1')
  })
})
