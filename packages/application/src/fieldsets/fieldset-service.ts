// Fieldset use cases (SPEC/contracts/fieldsets.md). Reading is open to a Site Admin and to any
// member of the organization, because every idea-type screen needs the sets; writing is the
// organization's Org Admin only (a Site Admin acts through View As).

import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import type { FieldDefinition } from '@collega/domain/fields'
import {
  createFieldset,
  type Fieldset,
  FieldsetDomainError,
  setFieldsetFields,
  updateFieldset,
} from '@collega/domain/fieldsets'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  ConflictError,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type { FieldDefinitionRepository } from '../fields/index.js'
import type { FieldsetModel, SaveFieldsetCommand, SetFieldsetFieldsCommand } from './models.js'
import type { FieldsetRepository, FieldsetUsage, OrganizationExistenceLookup } from './ports.js'

const DISPLAY_ORDER_STEP = 10

export class FieldsetService {
  constructor(
    private readonly fieldsets: FieldsetRepository,
    private readonly fieldDefinitions: FieldDefinitionRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string): Promise<readonly FieldsetModel[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const all = [...(await this.fieldsets.listByOrganization(organizationId))].sort(
      (a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id),
    )
    return this.toModels(organizationId, all)
  }

  async getById(organizationId: string, id: string): Promise<FieldsetModel> {
    this.ensureReadScope(organizationId)
    const fieldset = await this.requireFieldset(organizationId, id)
    return this.toModel(fieldset)
  }

  async create(organizationId: string, command: SaveFieldsetCommand): Promise<FieldsetModel> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)
    await this.ensureNameAvailable(organizationId, command.name, null)

    const now = this.clock.now()
    const displayOrder = command.displayOrder ?? (await this.nextDisplayOrder(organizationId))
    const fieldset = runDomain(createFieldset, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      description: command.description,
      displayOrder,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.fieldsets.add(fieldset)
    await this.unitOfWork.saveChanges()
    await this.audit('FieldsetCreated', fieldset, `Fieldset '${fieldset.name}' created.`, now)

    return this.toModel(fieldset)
  }

  async update(
    organizationId: string,
    id: string,
    command: SaveFieldsetCommand,
  ): Promise<FieldsetModel> {
    this.ensureAdminScope(organizationId)
    const existing = await this.requireFieldset(organizationId, id)
    await this.ensureNameAvailable(organizationId, command.name, id)

    const now = this.clock.now()
    const fieldset = runDomain(
      updateFieldset,
      existing,
      {
        name: command.name,
        description: command.description,
        displayOrder: command.displayOrder ?? existing.displayOrder,
      },
      now,
      this.currentUser.userId,
    )

    await this.fieldsets.save(fieldset)
    await this.unitOfWork.saveChanges()
    await this.audit('FieldsetUpdated', fieldset, `Fieldset '${fieldset.name}' updated.`, now)

    return this.toModel(fieldset)
  }

  /** Replaces the members and their order. Every id must name an active field of the
   * organization, once; listed order becomes `10, 20, 30, ...`. */
  async setFields(
    organizationId: string,
    id: string,
    command: SetFieldsetFieldsCommand,
  ): Promise<FieldsetModel> {
    this.ensureAdminScope(organizationId)
    const existing = await this.requireFieldset(organizationId, id)

    const activeIds = new Set(
      (await this.fieldDefinitions.listByOrganization(organizationId, false)).map((d) => d.id),
    )
    const seen = new Set<string>()
    for (const fieldDefinitionId of command.fieldDefinitionIds) {
      if (seen.has(fieldDefinitionId)) {
        throw new ValidationError('One or more fields are invalid.', {
          fieldDefinitionIds: ['A field may appear at most once in a fieldset.'],
        })
      }
      seen.add(fieldDefinitionId)
      if (!activeIds.has(fieldDefinitionId)) {
        throw new ValidationError('One or more fields are invalid.', {
          fieldDefinitionIds: [
            `'${fieldDefinitionId}' is not an active custom field in this organization.`,
          ],
        })
      }
    }

    // An existing member keeps its row id, so a reorder is an update rather than a delete and insert.
    const existingRowIds = new Map(existing.fields.map((f) => [f.fieldDefinitionId, f.id] as const))
    const now = this.clock.now()
    const fieldset = runDomain(
      setFieldsetFields,
      existing,
      command.fieldDefinitionIds.map((fieldDefinitionId, index) => ({
        id: existingRowIds.get(fieldDefinitionId) ?? randomUUID(),
        fieldDefinitionId,
        displayOrder: (index + 1) * DISPLAY_ORDER_STEP,
      })),
      now,
      this.currentUser.userId,
    )

    await this.fieldsets.save(fieldset)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'FieldsetFieldsUpdated',
      fieldset,
      `Fieldset '${fieldset.name}' members updated (${fieldset.fields.length}).`,
      now,
    )

    return this.toModel(fieldset)
  }

  async delete(organizationId: string, id: string): Promise<void> {
    this.ensureAdminScope(organizationId)
    const existing = await this.requireFieldset(organizationId, id)

    const usage = (await this.fieldsets.getUsage([id])).get(id)
    if (usage !== undefined && usage.total > 0) {
      throw new ConflictError(
        `This fieldset is used by ${usage.total} idea type(s). Remove it from them first.`,
      )
    }

    await this.fieldsets.delete(id)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'FieldsetDeleted',
      existing,
      `Fieldset '${existing.name}' deleted.`,
      this.clock.now(),
    )
  }

  private async requireFieldset(organizationId: string, id: string): Promise<Fieldset> {
    const fieldset = await this.fieldsets.getById(id)
    if (fieldset === null || fieldset.organizationId !== organizationId) {
      throw new NotFoundError('Fieldset not found.')
    }
    return fieldset
  }

  private async toModel(fieldset: Fieldset): Promise<FieldsetModel> {
    const [model] = await this.toModels(fieldset.organizationId, [fieldset])
    return model as FieldsetModel
  }

  private async toModels(
    organizationId: string,
    fieldsets: readonly Fieldset[],
  ): Promise<readonly FieldsetModel[]> {
    const [definitions, usage] = await Promise.all([
      this.fieldDefinitions.listByOrganization(organizationId, true),
      this.fieldsets.getUsage(fieldsets.map((f) => f.id)),
    ])
    const definitionsById = new Map(definitions.map((d) => [d.id, d] as const))
    return fieldsets.map((fieldset) => toModel(fieldset, definitionsById, usage.get(fieldset.id)))
  }

  private async nextDisplayOrder(organizationId: string): Promise<number> {
    const existing = await this.fieldsets.listByOrganization(organizationId)
    return existing.length === 0
      ? DISPLAY_ORDER_STEP
      : Math.max(...existing.map((f) => f.displayOrder)) + DISPLAY_ORDER_STEP
  }

  private async ensureNameAvailable(
    organizationId: string,
    name: string,
    excludeId: string | null,
  ): Promise<void> {
    if (!name || name.trim().length === 0) {
      // Let the domain produce the canonical "Name is required." message.
      return
    }
    if (await this.fieldsets.existsByName(organizationId, name, excludeId)) {
      throw new ValidationError('One or more fields are invalid.', {
        name: [`A fieldset named '${name.trim()}' already exists in this organization.`],
      })
    }
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Site Admin (any org) or a member of the target organization (any role) may read. */
  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin || this.currentUser.organizationId === organizationId) {
      return
    }
    throw new NotFoundError('Organization not found.')
  }

  /** Only the Org Admin of the target organization may write. */
  private ensureAdminScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)

    if (role === Role.OrgAdmin) {
      if (this.currentUser.organizationId === organizationId) {
        return
      }
      throw new NotFoundError('Organization not found.')
    }

    throw new ForbiddenError('You are not allowed to manage fieldsets in this organization.')
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    fieldset: Fieldset,
    message: string,
    occurredAtUtc: Date,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'Fieldset',
      message,
      occurredAtUtc,
      organizationId: fieldset.organizationId,
      attribution,
      entityId: fieldset.id,
      metadataJson: null,
    })
  }
}

function toModel(
  fieldset: Fieldset,
  definitionsById: ReadonlyMap<string, FieldDefinition>,
  usage: FieldsetUsage | undefined,
): FieldsetModel {
  return {
    fieldsetId: fieldset.id,
    organizationId: fieldset.organizationId,
    name: fieldset.name,
    description: fieldset.description,
    displayOrder: fieldset.displayOrder,
    usedByIdeaTypeCount: usage?.active ?? 0,
    fields: [...fieldset.fields]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .flatMap((member) => {
        const definition = definitionsById.get(member.fieldDefinitionId)
        return definition
          ? [
              {
                fieldDefinitionId: definition.id,
                name: definition.name,
                fieldType: definition.fieldType,
                isActive: !definition.isDeleted,
                displayOrder: member.displayOrder,
              },
            ]
          : []
      }),
  }
}

/** A `FieldsetDomainError` is a defensive backstop here (the service pre-checks what it can);
 * it surfaces as a field-keyed `400` rather than a 500. */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof FieldsetDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
