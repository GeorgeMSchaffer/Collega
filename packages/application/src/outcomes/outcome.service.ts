// Outcome use cases (SPEC/contracts/outcomes.md). Reading is open to every member of the
// organization; management and grouping are an in-scope Org Admin's. A Site Admin acting directly
// is refused on every route, reads included, and reads only through View As (decision 10).

import { randomUUID } from 'node:crypto'
import { Role, UserStatus } from '@collega/domain/enums'
import { setIdeaOutcome } from '@collega/domain/ideas'
import {
  createOutcome,
  type Outcome,
  OutcomeInvariantError,
  setOutcomeSortOrder,
  softDeleteOutcome,
  updateOutcome,
} from '@collega/domain/outcomes'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  normalizePageRequest,
  type PageRequest,
  type RandomSource,
  UnauthorizedError,
  type UnitOfWork,
  UnprocessableError,
  ValidationError,
} from '../common/index.js'
import { randomTagColor } from '../tags/random-color.js'
import type {
  CreateOutcomeCommand,
  IdeaOutcomeResult,
  OutcomeDetail,
  OutcomeItem,
  OutcomePage,
  OutcomeRollup,
  Roadmap,
  UpdateOutcomeCommand,
} from './models.js'
import type {
  OutcomeIdeasPort,
  OutcomeReadsPort,
  OutcomeRepository,
  OutcomeUsersPort,
} from './ports.js'

const EMPTY_ROLLUP: OutcomeRollup = {
  ideaCount: 0,
  doneIdeaCount: 0,
  taskCount: 0,
  doneTaskCount: 0,
  sprintStart: null,
  sprintEnd: null,
}

export class OutcomeService {
  constructor(
    private readonly outcomes: OutcomeRepository,
    private readonly reads: OutcomeReadsPort,
    private readonly ideas: OutcomeIdeasPort,
    private readonly users: OutcomeUsersPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  async list(
    organizationId: string,
    request: Partial<PageRequest> | undefined,
  ): Promise<OutcomePage> {
    this.ensureReadScope(organizationId)

    const { page, pageSize } = normalizePageRequest(request)
    const all = await this.outcomes.listByOrganization(organizationId)
    const slice = all.slice((page - 1) * pageSize, page * pageSize)

    return {
      items: await this.project(slice),
      page,
      pageSize,
      totalCount: all.length,
      sortBy: 'sortOrder',
      sortDirection: 'asc',
    }
  }

  async get(organizationId: string, outcomeId: string): Promise<OutcomeDetail> {
    this.ensureReadScope(organizationId)
    const outcome = await this.requireOutcome(outcomeId, organizationId)

    const [item] = await this.project([outcome])
    const ideas = await this.reads.ideasByOutcomeIds([outcome.id])
    return { ...(item as OutcomeItem), ideas: ideas.get(outcome.id) ?? [] }
  }

  /** Every Outcome with its items, and the top-level items under none. Unpaged. */
  async roadmap(organizationId: string): Promise<Roadmap> {
    this.ensureReadScope(organizationId)

    const outcomes = await this.outcomes.listByOrganization(organizationId)
    const items = await this.project(outcomes)
    const ideas = await this.reads.ideasByOutcomeIds(outcomes.map((o) => o.id))
    return {
      outcomes: items.map((item) => ({ ...item, ideas: ideas.get(item.outcomeId) ?? [] })),
      ungrouped: await this.reads.listUngroupedIdeas(organizationId),
    }
  }

  async create(organizationId: string, command: CreateOutcomeCommand): Promise<OutcomeItem> {
    this.ensureAdminScope(organizationId)

    const now = this.clock.now()
    const ownerUserId = await this.resolveOwner(organizationId, command.ownerUserId)
    const existing = await this.outcomes.listByOrganization(organizationId)
    const sortOrder = existing.reduce((max, o) => Math.max(max, o.sortOrder), -1) + 1

    const outcome = runDomain(createOutcome, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      description: command.description,
      targetStartDate: command.targetStartDate,
      targetEndDate: command.targetEndDate,
      ownerUserId,
      sortOrder,
      color: command.color ?? randomTagColor(this.random),
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.outcomes.add(outcome)
    await this.unitOfWork.saveChanges()

    await this.audit('OutcomeCreated', outcome, `Outcome '${outcome.name}' created.`, now, {
      ...fieldsOf(outcome),
    })

    return toItem(outcome, EMPTY_ROLLUP)
  }

  async update(
    organizationId: string,
    outcomeId: string,
    command: UpdateOutcomeCommand,
  ): Promise<OutcomeItem> {
    this.ensureAdminScope(organizationId)
    const existing = await this.requireOutcome(outcomeId, organizationId)

    const now = this.clock.now()
    const ownerUserId = await this.resolveOwner(organizationId, command.ownerUserId)

    // An absent colour is `undefined` (keep); an explicit `null` is refused.
    if (command.color === null) {
      throw new ValidationError('One or more fields are invalid.', {
        color: ['Color must be a valid #RRGGBB color.'],
      })
    }
    const outcome = runDomain(
      updateOutcome,
      existing,
      {
        name: command.name,
        description: command.description,
        targetStartDate: command.targetStartDate,
        targetEndDate: command.targetEndDate,
        ownerUserId,
        color: command.color ?? null,
      },
      now,
      this.currentUser.userId,
    )

    const changes = diff(fieldsOf(existing), fieldsOf(outcome))
    if (Object.keys(changes).length === 0) {
      return (await this.project([existing]))[0] as OutcomeItem
    }

    await this.outcomes.save(outcome)
    await this.unitOfWork.saveChanges()
    await this.audit('OutcomeUpdated', outcome, `Outcome '${outcome.name}' updated.`, now, {
      changes,
    })

    return (await this.project([outcome]))[0] as OutcomeItem
  }

  /**
   * Partial reorder: the listed Outcomes take the first positions in the listed order, the rest
   * keep their relative order after them, and `sortOrder` is renumbered `0..n-1`.
   */
  async reorder(organizationId: string, orderedIds: readonly string[] | null): Promise<void> {
    this.ensureAdminScope(organizationId)

    if (orderedIds === null || orderedIds.length === 0) {
      throw invalidOrderedIds('Ordered Ids is required.')
    }

    const active = await this.outcomes.listByOrganization(organizationId)
    const byId = new Map(active.map((o) => [o.id, o] as const))
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw invalidOrderedIds('Ordered Ids must not repeat an Outcome.')
    }
    if (!orderedIds.every((id) => byId.has(id))) {
      throw invalidOrderedIds('Ordered Ids must name Outcomes of this organization.')
    }

    const listed = new Set(orderedIds)
    const sequence = [
      ...orderedIds.map((id) => byId.get(id) as Outcome),
      ...active.filter((o) => !listed.has(o.id)),
    ]

    const now = this.clock.now()
    for (const [index, outcome] of sequence.entries()) {
      if (outcome.sortOrder !== index) {
        await this.outcomes.save(setOutcomeSortOrder(outcome, index, now, this.currentUser.userId))
      }
    }
    await this.unitOfWork.saveChanges()
  }

  /** Soft delete; every grouped item is ungrouped, none is deleted. Repeat delete is a 204. */
  async delete(organizationId: string, outcomeId: string): Promise<void> {
    this.ensureAdminScope(organizationId)

    const existing = await this.outcomes.getById(outcomeId)
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundError('Outcome not found.')
    }
    if (existing.isDeleted) {
      return
    }

    const now = this.clock.now()
    await this.outcomes.ungroupIdeas(existing.id)
    const outcome = softDeleteOutcome(existing, now, this.currentUser.userId)
    await this.outcomes.save(outcome)
    await this.unitOfWork.saveChanges()

    await this.audit('OutcomeDeleted', outcome, `Outcome '${outcome.name}' deleted.`, now, {
      ...fieldsOf(outcome),
    })
  }

  /** Sets or clears an item's single Outcome. A no-op writes nothing. */
  async setIdeaOutcome(ideaId: string, outcomeId: string | null): Promise<IdeaOutcomeResult> {
    this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)
    if (this.currentUser.role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to manage outcomes in this organization.')
    }

    const idea = await this.ideas.getById(ideaId)
    if (!idea || idea.organizationId !== this.currentUser.organizationId) {
      throw new NotFoundError('Idea not found.')
    }
    if (idea.parentIdeaId !== null) {
      throw new UnprocessableError(
        'taskCannotBeGrouped',
        'A task rolls up through its parent and cannot be grouped under an outcome.',
      )
    }

    let target: Outcome | null = null
    if (outcomeId !== null) {
      const found = await this.outcomes.getById(outcomeId)
      if (!found || found.isDeleted || found.organizationId !== idea.organizationId) {
        throw new ValidationError('One or more fields are invalid.', {
          outcomeId: ['Outcome not found.'],
        })
      }
      target = found
    }

    if (idea.outcomeId === (target?.id ?? null)) {
      return { ideaId: idea.id, outcomeId: idea.outcomeId }
    }

    const previous = idea.outcomeId === null ? null : await this.outcomes.getById(idea.outcomeId)
    const now = this.clock.now()
    await this.ideas.update(setIdeaOutcome(idea, target?.id ?? null, now, this.currentUser.userId))
    await this.unitOfWork.saveChanges()

    await this.auditEvents.write({
      eventType: 'IssueOutcomeGroupingChanged',
      entityType: 'Idea',
      message: target
        ? `Idea '${idea.title}' grouped under outcome '${target.name}'.`
        : `Idea '${idea.title}' ungrouped from its outcome.`,
      occurredAtUtc: now,
      organizationId: idea.organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: idea.id,
      metadataJson: JSON.stringify({
        ideaId: idea.id,
        fromOutcomeId: idea.outcomeId,
        fromOutcomeName: previous?.name ?? null,
        toOutcomeId: target?.id ?? null,
        toOutcomeName: target?.name ?? null,
      }),
    })

    return { ideaId: idea.id, outcomeId: target?.id ?? null }
  }

  private async project(outcomes: readonly Outcome[]): Promise<readonly OutcomeItem[]> {
    if (outcomes.length === 0) {
      return []
    }
    const rollups = await this.reads.rollupsByOutcomeIds(outcomes.map((o) => o.id))
    return outcomes.map((outcome) => toItem(outcome, rollups.get(outcome.id) ?? EMPTY_ROLLUP))
  }

  /** An owner, when named, must be an active user in the Outcome's organization. */
  private async resolveOwner(
    organizationId: string,
    ownerUserId: string | null,
  ): Promise<string | null> {
    const trimmed = ownerUserId?.trim()
    if (!trimmed) {
      return null
    }
    const [owner] = await this.users.listByIds([trimmed])
    if (!owner || owner.organizationId !== organizationId || owner.status !== UserStatus.Active) {
      throw new ValidationError('One or more fields are invalid.', {
        ownerUserId: ['Owner must be an active user in this organization.'],
      })
    }
    return owner.id
  }

  /** Missing, soft-deleted and other-organization Outcomes are all a 404. */
  private async requireOutcome(outcomeId: string, organizationId: string): Promise<Outcome> {
    const outcome = await this.outcomes.getById(outcomeId)
    if (!outcome || outcome.isDeleted || outcome.organizationId !== organizationId) {
      throw new NotFoundError('Outcome not found.')
    }
    return outcome
  }

  private ensureReadScope(organizationId: string): void {
    this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }
  }

  private ensureAdminScope(organizationId: string): void {
    this.ensureReadScope(organizationId)
    if (this.currentUser.role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to manage outcomes in this organization.')
    }
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    outcome: Outcome,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType,
      entityType: 'Outcome',
      message,
      occurredAtUtc,
      organizationId: outcome.organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: outcome.id,
      metadataJson: JSON.stringify(metadata),
    })
  }
}

function invalidOrderedIds(message: string): ValidationError {
  return new ValidationError('One or more fields are invalid.', { orderedIds: [message] })
}

function fieldsOf(outcome: Outcome): Record<string, unknown> {
  return {
    name: outcome.name,
    description: outcome.description,
    targetStartDate: outcome.targetStartDate,
    targetEndDate: outcome.targetEndDate,
    ownerUserId: outcome.ownerUserId,
    color: outcome.color,
  }
}

function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] }
    }
  }
  return changes
}

function toItem(outcome: Outcome, rollup: OutcomeRollup): OutcomeItem {
  return {
    outcomeId: outcome.id,
    organizationId: outcome.organizationId,
    name: outcome.name,
    description: outcome.description,
    targetStartDate: outcome.targetStartDate,
    targetEndDate: outcome.targetEndDate,
    ownerUserId: outcome.ownerUserId,
    sortOrder: outcome.sortOrder,
    color: outcome.color,
    ...rollup,
  }
}

function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof OutcomeInvariantError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
