// An item's metric values (SPEC/contracts/metric-types.md). Whoever may read the item reads them;
// whoever may edit it (its author or an in-scope Org Admin, never Read Only) replaces them. A Site
// Admin acting directly is refused on both.

import { Role } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import { checkMetricNumber, MetricTypeInvariantError } from '@collega/domain/metric-types'
import { ensureCanSeeBoard } from '../boards/board-access.js'
import type { BoardAccessLookup } from '../boards/ports.js'
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
  UnprocessableError,
  ValidationError,
} from '../common/index.js'
import type { IdeaMetric, IdeaMetricInput } from './models.js'
import type {
  IdeaMetricValuesPort,
  IdeaMetricWrite,
  MetricIdeasPort,
  MetricTypeRepository,
} from './ports.js'

type Pair = { readonly projected: number | null; readonly realized: number | null }

export class IdeaMetricsService {
  constructor(
    private readonly ideas: MetricIdeasPort,
    private readonly metricTypes: MetricTypeRepository,
    private readonly values: IdeaMetricValuesPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly boardAccess: BoardAccessLookup,
  ) {}

  async get(ideaId: string): Promise<readonly IdeaMetric[]> {
    this.requireRole()
    ensureNotDirectSiteAdmin(this.currentUser)
    const idea = await this.requireIdea(ideaId)
    return idea.parentIdeaId === null ? this.values.listByIdea(idea.id) : []
  }

  async replace(
    ideaId: string,
    entries: readonly IdeaMetricInput[],
  ): Promise<readonly IdeaMetric[]> {
    const role = this.requireRole()
    ensureNotDirectSiteAdmin(this.currentUser)
    if (role === Role.ReadOnly) {
      throw new ForbiddenError('Read Only users cannot edit items.')
    }
    const idea = await this.requireIdea(ideaId)
    this.ensureCanEdit(idea, role)
    if (idea.parentIdeaId !== null) {
      throw new UnprocessableError(
        'taskCannotCarryMetrics',
        'A task rolls up through its parent and cannot carry metric values.',
      )
    }

    const types = new Map(
      (await this.metricTypes.listByOrganization(idea.organizationId, true)).map(
        (t) => [t.id, t] as const,
      ),
    )
    const wanted = new Map<string, Pair>()
    for (const entry of entries) {
      const type = types.get(entry.metricTypeId)
      if (!type || type.isArchived) {
        throw invalid('Metric type not found.')
      }
      if (wanted.has(entry.metricTypeId)) {
        throw invalid('Metric types must not repeat.')
      }
      try {
        if (entry.projected !== null) checkMetricNumber('Projected', entry.projected)
        if (entry.realized !== null) checkMetricNumber('Realized', entry.realized)
      } catch (error) {
        if (error instanceof MetricTypeInvariantError) {
          throw invalid(error.message)
        }
        throw error
      }
      // A repeat of a type that clears is still a repeat, so record it either way.
      wanted.set(entry.metricTypeId, { projected: entry.projected, realized: entry.realized })
    }

    // Full replacement over active types: values on archived types are neither read nor touched.
    const current = (await this.values.listByIdea(idea.id)).filter((m) => !m.isArchived)
    const currentById = new Map(current.map((m) => [m.metricTypeId, m] as const))

    const upserts: IdeaMetricWrite[] = []
    const keep = new Set<string>()
    for (const [metricTypeId, pair] of wanted) {
      if (pair.projected === null && pair.realized === null) {
        continue
      }
      keep.add(metricTypeId)
      const stored = currentById.get(metricTypeId)
      if (!stored || stored.projected !== pair.projected || stored.realized !== pair.realized) {
        upserts.push({ metricTypeId, ...pair })
      }
    }
    const cleared = current.filter((m) => !keep.has(m.metricTypeId)).map((m) => m.metricTypeId)

    if (upserts.length === 0 && cleared.length === 0) {
      return this.values.listByIdea(idea.id)
    }

    const now = this.clock.now()
    await this.values.apply(idea.id, upserts, cleared)
    await this.unitOfWork.saveChanges()

    const after = await this.values.listByIdea(idea.id)
    const snapshot = (list: readonly IdeaMetric[]) =>
      list
        .filter((m) => !m.isArchived)
        .map((m) => ({
          metricTypeId: m.metricTypeId,
          name: m.name,
          projected: m.projected,
          realized: m.realized,
        }))
    await this.auditEvents.write({
      eventType: 'IdeaMetricsChanged',
      entityType: 'Idea',
      message: `Metric values changed on idea '${idea.title}'.`,
      occurredAtUtc: now,
      organizationId: idea.organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: idea.id,
      metadataJson: JSON.stringify({
        ideaId: idea.id,
        before: snapshot(current),
        after: snapshot(after),
      }),
    })
    return after
  }

  private requireRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  /** Missing, deleted and other-organization items are all a 404. */
  private async requireIdea(ideaId: string): Promise<Idea> {
    const idea = await this.ideas.getById(ideaId)
    if (!idea || idea.organizationId !== this.currentUser.organizationId) {
      throw new NotFoundError('Idea not found.')
    }
    await ensureCanSeeBoard(this.boardAccess, this.currentUser, idea.boardId, 'Idea not found.')
    return idea
  }

  private ensureCanEdit(idea: Idea, role: Role): void {
    if (role === Role.OrgAdmin || this.currentUser.userId === idea.authorUserId) {
      return
    }
    throw new ForbiddenError("You are not allowed to change this item's metric values.")
  }
}

function invalid(message: string): ValidationError {
  return new ValidationError('One or more fields are invalid.', { metrics: [message] })
}
