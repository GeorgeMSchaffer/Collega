// Idea Type option administration (SPEC/30-Contracts.md "Idea Field Option Contracts",
// SPEC/20-feature-idea-type-fields.md). Listing is available to any member of the organization
// (idea forms need the option catalog); create/update/reorder/delete/field-selection/appearance
// are Site Admin (any org) or in-scope Org Admin only.
//
// The .NET combined this with Business Impact administration in one `IdeaFieldService` partial
// class, sharing authorization/ordering/uniqueness helpers. Split here because Business Impact
// now lives in its own partition folder (`packages/application/src/business-impacts`) - the two
// only ever shared boilerplate, never state, so each service carries its own copy, matching how
// Boards and Statuses independently duplicate the identical `ensureReadScope`/`ensureAdminScope`
// pattern rather than sharing it (see `../statuses/status-service.ts`).

import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import {
  createIdeaType,
  type IdeaType,
  IdeaTypeDomainError,
  MINIMUM_ACTIVE_IDEA_TYPES_PER_ORGANIZATION,
  setIdeaTypeAppearance,
  setIdeaTypeFieldSelection,
  setIdeaTypeSortOrder,
  softDeleteIdeaType,
  updateIdeaType,
} from '@collega/domain/idea-fields'
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
import type { FieldDefinitionRepository } from '../fields/index.js'
import type {
  CreateIdeaTypeCommand,
  IdeaTypeFieldSelectionInput,
  IdeaTypeItem,
  UpdateIdeaTypeCommand,
} from './models.js'
import type { IdeaTypeRepository, OrganizationExistenceLookup } from './ports.js'

const SORT_ORDER_STEP = 10

export class IdeaTypeService {
  constructor(
    private readonly ideaTypes: IdeaTypeRepository,
    private readonly fieldDefinitions: FieldDefinitionRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string, includeDeleted: boolean): Promise<readonly IdeaTypeItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const options = await this.ideaTypes.listByOrganization(organizationId, includeDeleted)
    return options.map(toItem)
  }

  async create(organizationId: string, command: CreateIdeaTypeCommand): Promise<IdeaTypeItem> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const existing = await this.ideaTypes.listByOrganization(organizationId, true)
    ensureNameAvailable(
      command.name,
      existing.filter((o) => !o.isDeleted).map((o) => o.name),
      null,
    )

    const now = this.clock.now()
    const sortOrder = command.sortOrder ?? nextSortOrder(existing.map((o) => o.sortOrder))
    const ideaType = runDomain(createIdeaType, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      sortOrder,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.ideaTypes.add(ideaType)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'IdeaTypeCreated',
      organizationId,
      ideaType.id,
      `Idea Type '${ideaType.name}' created.`,
      now,
    )

    return toItem(ideaType)
  }

  async update(ideaTypeId: string, command: UpdateIdeaTypeCommand): Promise<IdeaTypeItem> {
    const existingOption = await this.ideaTypes.getById(ideaTypeId)
    if (existingOption === null) {
      throw new NotFoundError('Idea Type not found.')
    }
    this.ensureAdminScope(existingOption.organizationId)
    if (existingOption.isDeleted) {
      throw new NotFoundError('Idea Type not found.')
    }

    const existing = await this.ideaTypes.listByOrganization(existingOption.organizationId, false)
    ensureNameAvailable(
      command.name,
      existing.map((o) => o.name),
      existingOption.name,
    )

    const now = this.clock.now()
    const ideaType = runDomain(
      updateIdeaType,
      existingOption,
      { name: command.name, sortOrder: command.sortOrder ?? existingOption.sortOrder },
      now,
      this.currentUser.userId,
    )
    await this.ideaTypes.save(ideaType)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'IdeaTypeUpdated',
      ideaType.organizationId,
      ideaType.id,
      `Idea Type '${ideaType.name}' updated.`,
      now,
    )

    return toItem(ideaType)
  }

  /**
   * Replaces the complete active-option order atomically - every `save` below is staged and
   * committed with a single `unitOfWork.saveChanges()` after the loop (SPEC/decisions.md
   * 2026-09-06 "Wave B conventions").
   */
  async reorder(organizationId: string, orderedIds: readonly string[]): Promise<void> {
    this.ensureAdminScope(organizationId)

    const active = await this.ideaTypes.listByOrganization(organizationId, false)
    ensureReorderCoversActive(
      orderedIds,
      active.map((o) => o.id),
    )

    const now = this.clock.now()
    const byId = new Map(active.map((o) => [o.id, o] as const))
    for (const [index, id] of orderedIds.entries()) {
      const current = byId.get(id)
      if (current === undefined) {
        continue
      }
      const updated = setIdeaTypeSortOrder(
        current,
        (index + 1) * SORT_ORDER_STEP,
        now,
        this.currentUser.userId,
      )
      await this.ideaTypes.save(updated)
    }

    await this.unitOfWork.saveChanges()
    await this.audit(
      'IdeaTypesReordered',
      organizationId,
      organizationId,
      'Idea Type order updated.',
      now,
    )
  }

  async delete(ideaTypeId: string): Promise<void> {
    const existing = await this.ideaTypes.getById(ideaTypeId)
    if (existing === null) {
      throw new NotFoundError('Idea Type not found.')
    }
    this.ensureAdminScope(existing.organizationId)
    if (existing.isDeleted) {
      return
    }

    const activeCount = await this.ideaTypes.countActiveByOrganization(existing.organizationId)
    if (activeCount <= MINIMUM_ACTIVE_IDEA_TYPES_PER_ORGANIZATION) {
      throw new ValidationError('One or more fields are invalid.', {
        ideaType: [
          'An organization must keep at least one active Idea Type; this option cannot be deleted.',
        ],
      })
    }

    const now = this.clock.now()
    const ideaType = runDomain(softDeleteIdeaType, existing, now, this.currentUser.userId)
    await this.ideaTypes.save(ideaType)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'IdeaTypeDeleted',
      ideaType.organizationId,
      ideaType.id,
      `Idea Type '${ideaType.name}' soft-deleted.`,
      now,
    )
  }

  /** Replaces an Idea Type's User-Defined Field selection (SPEC/20-feature-idea-type-fields.md).
   * A non-empty selection switches the type to `Curated`; an empty selection clears it back to
   * `AllActiveFields`. Every field must be active and in the same organization (else `400`); no
   * field may repeat. `404` when the type does not exist in the organization. */
  async setFieldSelection(
    organizationId: string,
    ideaTypeId: string,
    fields: readonly IdeaTypeFieldSelectionInput[],
  ): Promise<void> {
    this.ensureAdminScope(organizationId)

    const existing = await this.ideaTypes.getById(ideaTypeId)
    if (existing === null || existing.organizationId !== organizationId || existing.isDeleted) {
      throw new NotFoundError('Idea Type not found.')
    }

    const selection = fields ?? []

    // Every selected field must be active and in the same organization; none may repeat.
    const activeFieldIds = new Set(
      (await this.fieldDefinitions.listByOrganization(organizationId, false)).map((d) => d.id),
    )

    const seen = new Set<string>()
    for (const field of selection) {
      if (seen.has(field.fieldDefinitionId)) {
        throw new ValidationError('One or more fields are invalid.', {
          fields: ['A field may appear at most once in the selection.'],
        })
      }
      seen.add(field.fieldDefinitionId)

      if (!activeFieldIds.has(field.fieldDefinitionId)) {
        throw new ValidationError('One or more fields are invalid.', {
          fields: [
            `'${field.fieldDefinitionId}' is not an active custom field in this organization.`,
          ],
        })
      }
    }

    const now = this.clock.now()
    const links = selection.map((f) => ({
      id: randomUUID(),
      fieldDefinitionId: f.fieldDefinitionId,
      displayOrder: f.displayOrder,
      isRequired: f.isRequired,
    }))
    const ideaType = runDomain(
      setIdeaTypeFieldSelection,
      existing,
      links,
      now,
      this.currentUser.userId,
    )

    await this.ideaTypes.save(ideaType)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'IdeaTypeFieldsUpdated',
      organizationId,
      ideaType.id,
      `Idea Type '${ideaType.name}' field selection updated (${ideaType.fieldMode}).`,
      now,
    )
  }

  /** Sets or clears an Idea Type's badge appearance. `colorHex` must be `#RRGGBB` when present
   * (else `400`). `404` when the type does not exist in the organization. */
  async setAppearance(
    organizationId: string,
    ideaTypeId: string,
    colorHex: string | null,
    icon: string | null,
  ): Promise<void> {
    this.ensureAdminScope(organizationId)

    const existing = await this.ideaTypes.getById(ideaTypeId)
    if (existing === null || existing.organizationId !== organizationId || existing.isDeleted) {
      throw new NotFoundError('Idea Type not found.')
    }

    const now = this.clock.now()
    const ideaType = runDomain(
      setIdeaTypeAppearance,
      existing,
      colorHex,
      icon,
      now,
      this.currentUser.userId,
    )

    await this.ideaTypes.save(ideaType)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'IdeaTypeAppearanceUpdated',
      organizationId,
      ideaType.id,
      `Idea Type '${ideaType.name}' appearance updated.`,
      now,
    )
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Site Admin (any org) or a member of the target organization (any role) may read the catalog. */
  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin || this.currentUser.organizationId === organizationId) {
      return
    }
    throw new NotFoundError('Organization not found.')
  }

  /** Site Admin (any org) or Org Admin (own org) may manage idea field options. */
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
      'You are not allowed to manage idea field options in this organization.',
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
    entityId: string,
    message: string,
    occurredAtUtc: Date,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'IdeaType',
      message,
      occurredAtUtc,
      organizationId,
      attribution,
      entityId,
      metadataJson: null,
    })
  }
}

function toItem(ideaType: IdeaType): IdeaTypeItem {
  return {
    ideaTypeId: ideaType.id,
    organizationId: ideaType.organizationId,
    name: ideaType.name,
    sortOrder: ideaType.sortOrder,
    isDeleted: ideaType.isDeleted,
    colorHex: ideaType.colorHex,
    icon: ideaType.icon,
    fieldMode: ideaType.fieldMode,
    fields: [...ideaType.fields]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((f) => ({
        fieldDefinitionId: f.fieldDefinitionId,
        displayOrder: f.displayOrder,
        isRequired: f.isRequired,
      })),
  }
}

function ensureNameAvailable(
  name: string,
  activeNames: readonly string[],
  currentName: string | null,
): void {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) {
    throw new ValidationError('One or more fields are invalid.', { name: ['Name is required.'] })
  }

  // Active labels are unique case-insensitively within the same organization and option type.
  const matchesCurrent = currentName !== null && trimmed.toLowerCase() === currentName.toLowerCase()
  if (!matchesCurrent && activeNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
    throw new ValidationError('One or more fields are invalid.', {
      name: [`An option named '${trimmed}' already exists in this organization.`],
    })
  }
}

function ensureReorderCoversActive(
  orderedIds: readonly string[],
  activeIds: readonly string[],
): void {
  const active = new Set(activeIds)
  const distinctCount = new Set(orderedIds).size
  const covers =
    orderedIds.length === active.size &&
    distinctCount === orderedIds.length &&
    orderedIds.every((id) => active.has(id))
  if (!covers) {
    throw new ValidationError('One or more fields are invalid.', {
      orderedIds: ['The reorder must list every active option exactly once.'],
    })
  }
}

function nextSortOrder(existing: readonly number[]): number {
  return existing.length === 0 ? SORT_ORDER_STEP : Math.max(...existing) + SORT_ORDER_STEP
}

/**
 * Wraps a domain transition so an `IdeaTypeDomainError` surfaces as a field-keyed `ValidationError`
 * instead of letting a bare `Error` become a 500, mirroring `runDomain` in `../statuses/status-
 * service.ts` (SPEC/decisions.md 2026-09-06 "Wave B conventions").
 *
 * UNREACHABLE BY CONSTRUCTION for every call site above, not a sign a precondition is missing:
 * name/color/selection are all validated in this service before the domain ever sees them,
 * exactly mirroring how the .NET `IdeaFieldService` never wrapped these calls - its domain's own
 * `ArgumentException`s were defensive backstops that would have 500'd had they fired. This wrapper
 * is kept purely so a future change that removes one of those pre-checks fails safe (a 400)
 * instead of silently regressing to a 500.
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof IdeaTypeDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
