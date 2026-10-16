// Metric type use cases (SPEC/contracts/metric-types.md). Every member reads, an in-scope Org
// Admin manages, and a Site Admin acting directly is refused on every route, reads included.

import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import {
  createMetricType,
  type MetricType,
  MetricTypeInvariantError,
  updateMetricType,
} from '@collega/domain/metric-types'
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
import type { MetricTypeInput, MetricTypeItem, UpdateMetricTypeCommand } from './models.js'
import type { MetricTypeRepository } from './ports.js'

export class MetricTypeService {
  constructor(
    private readonly metricTypes: MetricTypeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string, includeArchived: boolean): Promise<readonly MetricTypeItem[]> {
    this.ensureReadScope(organizationId)
    const types = await this.metricTypes.listByOrganization(organizationId, includeArchived)
    return types.map(toItem)
  }

  async create(organizationId: string, command: MetricTypeInput): Promise<MetricTypeItem> {
    this.ensureAdminScope(organizationId)

    const now = this.clock.now()
    const metricType = runDomain(createMetricType, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      unit: command.unit,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.metricTypes.add(metricType)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'MetricTypeCreated',
      metricType,
      `Metric type '${metricType.name}' created.`,
      now,
      fieldsOf(metricType),
    )
    return toItem(metricType)
  }

  async update(
    organizationId: string,
    metricTypeId: string,
    command: UpdateMetricTypeCommand,
  ): Promise<MetricTypeItem> {
    this.ensureAdminScope(organizationId)
    const existing = await this.metricTypes.getById(metricTypeId)
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundError('Metric type not found.')
    }

    const now = this.clock.now()
    const updated = runDomain(
      updateMetricType,
      existing,
      { name: command.name, unit: command.unit, isArchived: command.isArchived },
      now,
      this.currentUser.userId,
    )

    const before = fieldsOf(existing)
    const after = fieldsOf(updated)
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of Object.keys(after)) {
      if (before[key] !== after[key]) {
        changes[key] = { from: before[key], to: after[key] }
      }
    }
    if (Object.keys(changes).length === 0) {
      return toItem(existing)
    }

    await this.metricTypes.save(updated)
    await this.unitOfWork.saveChanges()

    const archiveChanged = existing.isArchived !== updated.isArchived
    const eventType = !archiveChanged
      ? 'MetricTypeUpdated'
      : updated.isArchived
        ? 'MetricTypeArchived'
        : 'MetricTypeRestored'
    await this.audit(eventType, updated, `Metric type '${updated.name}' ${verb(eventType)}.`, now, {
      changes,
    })
    return toItem(updated)
  }

  private ensureReadScope(organizationId: string): void {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    ensureNotDirectSiteAdmin(this.currentUser)
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }
  }

  private ensureAdminScope(organizationId: string): void {
    this.ensureReadScope(organizationId)
    if (this.currentUser.role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to manage metric types in this organization.')
    }
  }

  private async audit(
    eventType: string,
    metricType: MetricType,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType,
      entityType: 'MetricType',
      message,
      occurredAtUtc,
      organizationId: metricType.organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: metricType.id,
      metadataJson: JSON.stringify(metadata),
    })
  }
}

function verb(eventType: string): string {
  return eventType === 'MetricTypeArchived'
    ? 'archived'
    : eventType === 'MetricTypeRestored'
      ? 'restored'
      : 'updated'
}

function fieldsOf(metricType: MetricType): Record<string, unknown> {
  return { name: metricType.name, unit: metricType.unit, isArchived: metricType.isArchived }
}

function toItem(metricType: MetricType): MetricTypeItem {
  return {
    metricTypeId: metricType.id,
    organizationId: metricType.organizationId,
    name: metricType.name,
    unit: metricType.unit,
    isArchived: metricType.isArchived,
    createdAt: metricType.createdAtUtc,
    updatedAt: metricType.updatedAtUtc,
  }
}

function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof MetricTypeInvariantError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
