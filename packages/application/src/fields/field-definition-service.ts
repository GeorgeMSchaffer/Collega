// User-Defined Field definition use cases (SPEC/20-feature-user-defined-fields.md). Site Admin
// may manage any organization; Org Admin only their own. Listing/getting active definitions is
// available to any authenticated member of the organization because every idea form needs the
// field schema; create/update/delete/reorder and `includeDeleted` are admin-only.

import { randomUUID } from 'node:crypto'
import { FieldType, Role } from '@collega/domain/enums'
import {
  createFieldDefinition,
  type FieldDefinition,
  FieldDefinitionDomainError,
  type FieldOptionInput,
  isOptionBackedFieldType,
  setFieldDefinitionDisplayOrder,
  setFieldDefinitionOptions,
  softDeleteFieldDefinition,
  updateFieldDefinition,
} from '@collega/domain/fields'
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
import type {
  CreateFieldDefinitionCommand,
  FieldDefinitionModel,
  FieldOptionCommand,
  ReorderFieldDefinitionsCommand,
  UpdateFieldDefinitionCommand,
} from './models.js'
import type { FieldDefinitionRepository, OrganizationExistenceLookup } from './ports.js'

const DISPLAY_ORDER_STEP = 10

export class FieldDefinitionService {
  constructor(
    private readonly fieldDefinitions: FieldDefinitionRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly FieldDefinitionModel[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    // Archived definitions are visible to admins only; members always see the active schema only.
    const effectiveIncludeDeleted = includeDeleted && this.isAdminScope(organizationId)
    const definitions = await this.fieldDefinitions.listByOrganization(
      organizationId,
      effectiveIncludeDeleted,
    )
    return definitions.map(toModel)
  }

  async getById(organizationId: string, id: string): Promise<FieldDefinitionModel> {
    this.ensureReadScope(organizationId)

    const definition = await this.fieldDefinitions.getById(id)
    if (definition === null || definition.organizationId !== organizationId) {
      throw new NotFoundError('Field definition not found.')
    }

    // Members cannot see archived definitions; admins can.
    if (definition.isDeleted && !this.isAdminScope(organizationId)) {
      throw new NotFoundError('Field definition not found.')
    }

    return toModel(definition)
  }

  async create(
    organizationId: string,
    command: CreateFieldDefinitionCommand,
  ): Promise<FieldDefinitionModel> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const fieldType = parseFieldType(command.fieldType)
    await this.ensureNameAvailable(organizationId, command.name, null)

    const now = this.clock.now()
    const displayOrder = command.displayOrder ?? (await this.nextDisplayOrder(organizationId))
    const options = toOptionInputs(command.options)

    const definition = runDomain(createFieldDefinition, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      description: command.description,
      fieldType,
      isRequired: command.isRequired,
      displayOrder,
      options,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.fieldDefinitions.add(definition)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'FieldDefinitionCreated',
      organizationId,
      definition.id,
      `Field '${definition.name}' created.`,
      now,
      { name: definition.name, fieldType: definition.fieldType, isRequired: definition.isRequired },
    )

    return toModel(definition)
  }

  async update(
    organizationId: string,
    id: string,
    command: UpdateFieldDefinitionCommand,
  ): Promise<FieldDefinitionModel> {
    this.ensureAdminScope(organizationId)

    const existing = await this.fieldDefinitions.getById(id)
    if (existing === null || existing.organizationId !== organizationId || existing.isDeleted) {
      throw new NotFoundError('Field definition not found.')
    }

    const fieldType = parseFieldType(command.fieldType)
    if (fieldType !== existing.fieldType) {
      throw new ValidationError('One or more fields are invalid.', {
        fieldType: ['Field type cannot be changed after creation.'],
      })
    }

    await this.ensureNameAvailable(organizationId, command.name, id)

    const now = this.clock.now()
    const displayOrder = command.displayOrder ?? existing.displayOrder

    let definition = runDomain(
      updateFieldDefinition,
      existing,
      {
        name: command.name,
        description: command.description,
        isRequired: command.isRequired,
        displayOrder,
      },
      now,
      this.currentUser.userId,
    )
    if (isOptionBackedFieldType(definition.fieldType)) {
      definition = runDomain(
        setFieldDefinitionOptions,
        definition,
        toOptionInputs(command.options),
        now,
        this.currentUser.userId,
      )
    }

    await this.fieldDefinitions.save(definition)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'FieldDefinitionUpdated',
      organizationId,
      definition.id,
      `Field '${definition.name}' updated.`,
      now,
      {
        name: definition.name,
        isRequired: definition.isRequired,
        displayOrder: definition.displayOrder,
      },
    )

    return toModel(definition)
  }

  async delete(organizationId: string, id: string): Promise<void> {
    this.ensureAdminScope(organizationId)

    const existing = await this.fieldDefinitions.getById(id)
    if (existing === null || existing.organizationId !== organizationId) {
      throw new NotFoundError('Field definition not found.')
    }

    if (existing.isDeleted) {
      // Soft delete is idempotent.
      return
    }

    const now = this.clock.now()
    const definition = runDomain(softDeleteFieldDefinition, existing, now, this.currentUser.userId)
    await this.fieldDefinitions.save(definition)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'FieldDefinitionDeleted',
      organizationId,
      definition.id,
      `Field '${definition.name}' archived.`,
      now,
      null,
    )
  }

  /**
   * Replaces every active definition's display order atomically - every `save` below is staged
   * and committed with a single `unitOfWork.saveChanges()` after the loop, mirroring the .NET's
   * single post-loop `SaveChangesAsync` (SPEC/decisions.md 2026-09-06 "Wave B conventions").
   */
  async reorder(organizationId: string, command: ReorderFieldDefinitionsCommand): Promise<void> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const definitions = await this.fieldDefinitions.listActiveByOrganization(organizationId)
    const byId = new Map(definitions.map((d) => [d.id, d] as const))

    const now = this.clock.now()
    let order = 0
    const assigned = new Set<string>()
    for (const definitionId of command.orderedIds ?? []) {
      // Unknown/archived ids and repeats are ignored (the active set is authoritative).
      const definition = byId.get(definitionId)
      if (definition === undefined || assigned.has(definitionId)) {
        continue
      }
      assigned.add(definitionId)

      order += DISPLAY_ORDER_STEP
      const updated = setFieldDefinitionDisplayOrder(
        definition,
        order,
        now,
        this.currentUser.userId,
      )
      await this.fieldDefinitions.save(updated)
    }

    // Any active definitions the caller omitted keep their prior relative order, appended after
    // the explicitly ordered ones - so every active field gets a fresh, collision-free display
    // order (`definitions` is already sorted by display order).
    for (const definition of definitions) {
      if (assigned.has(definition.id)) {
        continue
      }
      order += DISPLAY_ORDER_STEP
      const updated = setFieldDefinitionDisplayOrder(
        definition,
        order,
        now,
        this.currentUser.userId,
      )
      await this.fieldDefinitions.save(updated)
    }

    await this.unitOfWork.saveChanges()
    await this.audit(
      'FieldDefinitionsReordered',
      organizationId,
      null,
      'Field display order updated.',
      now,
      null,
    )
  }

  private async nextDisplayOrder(organizationId: string): Promise<number> {
    const existing = await this.fieldDefinitions.listByOrganization(organizationId, true)
    if (existing.length === 0) {
      return DISPLAY_ORDER_STEP
    }
    return Math.max(...existing.map((d) => d.displayOrder)) + DISPLAY_ORDER_STEP
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

    if (await this.fieldDefinitions.existsActiveByName(organizationId, name, excludeId)) {
      throw new ValidationError('One or more fields are invalid.', {
        name: [`A field named '${name.trim()}' already exists in this organization.`],
      })
    }
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Site Admin (any org) or a member of the target organization (any role) may read the schema. */
  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin || this.currentUser.organizationId === organizationId) {
      return
    }
    throw new NotFoundError('Organization not found.')
  }

  /** Site Admin (any org) or Org Admin (own org) may manage field definitions. */
  private ensureAdminScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()

    // Rule 25: a Site Admin acting as themselves may not mutate org-owned content - View As is
    // the path. No impersonation branch is needed: while a session is live this role is the
    // target's, so the guard does not fire. Read paths use ensureReadScope and are unaffected.
    ensureNotDirectSiteAdmin(this.currentUser)

    // No SiteAdmin pass-through below, deliberately: the guard above has already refused that
    // role, so a `return` here would be dead code that reads like a live bypass.
    if (role === Role.OrgAdmin) {
      if (this.currentUser.organizationId === organizationId) {
        return
      }
      throw new NotFoundError('Organization not found.')
    }

    throw new ForbiddenError(
      'You are not allowed to manage field definitions in this organization.',
    )
  }

  private isAdminScope(organizationId: string): boolean {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      return false
    }
    return (
      this.currentUser.role === Role.SiteAdmin ||
      (this.currentUser.role === Role.OrgAdmin &&
        this.currentUser.organizationId === organizationId)
    )
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    organizationId: string,
    entityId: string | null,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'FieldDefinition',
      message,
      occurredAtUtc,
      organizationId,
      attribution,
      entityId,
      metadataJson: metadata === null ? null : JSON.stringify(metadata),
    })
  }
}

function toModel(definition: FieldDefinition): FieldDefinitionModel {
  return {
    fieldDefinitionId: definition.id,
    organizationId: definition.organizationId,
    name: definition.name,
    description: definition.description,
    fieldType: definition.fieldType,
    isRequired: definition.isRequired,
    displayOrder: definition.displayOrder,
    isDeleted: definition.isDeleted,
    options: [...definition.options]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((o) => ({ optionId: o.id, label: o.label, displayOrder: o.displayOrder })),
  }
}

function toOptionInputs(
  options: readonly FieldOptionCommand[] | null | undefined,
): readonly FieldOptionInput[] {
  return (options ?? []).map((o, index) => ({
    id: o.optionId ?? randomUUID(),
    label: o.label,
    displayOrder: o.displayOrder === 0 ? index : o.displayOrder,
  }))
}

function parseFieldType(fieldType: string): FieldType {
  const trimmed = (fieldType ?? '').trim()
  const match = Object.values(FieldType).find(
    (value) => value.toLowerCase() === trimmed.toLowerCase(),
  )
  if (trimmed.length > 0 && match !== undefined) {
    return match
  }

  throw new ValidationError('One or more fields are invalid.', {
    fieldType: [`Field type must be one of: ${Object.values(FieldType).join(', ')}.`],
  })
}

/**
 * Wraps a domain transition so a `FieldDefinitionDomainError` surfaces as a `ValidationError`
 * bucketed under the fixed `fieldDefinition` key - mirroring the .NET `FieldDefinitionService`'s
 * shared `AsValidation` helper exactly, INCLUDING the fact that it does not key by the specific
 * property that failed. This is a deliberate departure from `IdeaDomainError`/
 * `BoardInvariantError`'s per-field keying (the `runDomain` reference elsewhere in Wave B): every
 * `FieldDefinitionService` call site in the .NET used one shared `AsValidation` that always threw
 * `ValidationAppException("fieldDefinition", new[] { ex.Message })` regardless of which invariant
 * fired, and the corpus records whatever that produced.
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof FieldDefinitionDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        fieldDefinition: [error.message],
      })
    }
    throw error
  }
}
