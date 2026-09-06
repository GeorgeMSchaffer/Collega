// Business Impact option administration (SPEC/30-Contracts.md "Idea Field Option Contracts").
// Listing is available to any member of the organization (idea forms need the option catalog);
// create/update/reorder/delete are Site Admin (any org) or in-scope Org Admin only.
//
// The .NET combined this with Idea Type administration in one `IdeaFieldService` partial class,
// sharing authorization/ordering/uniqueness helpers. Split here because Business Impact now lives
// in its own partition folder - see `../idea-fields/idea-type-service.ts` for the same note.

import { randomUUID } from 'node:crypto'
import {
  type BusinessImpact,
  BusinessImpactDomainError,
  createBusinessImpact,
  MINIMUM_ACTIVE_BUSINESS_IMPACTS_PER_ORGANIZATION,
  setBusinessImpactSortOrder,
  softDeleteBusinessImpact,
  updateBusinessImpact,
} from '@collega/domain/business-impacts'
import { Role } from '@collega/domain/enums'
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
  BusinessImpactItem,
  CreateBusinessImpactCommand,
  UpdateBusinessImpactCommand,
} from './models.js'
import type { BusinessImpactRepository, OrganizationExistenceLookup } from './ports.js'

const SORT_ORDER_STEP = 10
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export class BusinessImpactService {
  constructor(
    private readonly businessImpacts: BusinessImpactRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly BusinessImpactItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const options = await this.businessImpacts.listByOrganization(organizationId, includeDeleted)
    return options.map(toItem)
  }

  async create(
    organizationId: string,
    command: CreateBusinessImpactCommand,
  ): Promise<BusinessImpactItem> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)
    ensureValidColor(command.color)

    const existing = await this.businessImpacts.listByOrganization(organizationId, true)
    ensureNameAvailable(
      command.name,
      existing.filter((o) => !o.isDeleted).map((o) => o.name),
      null,
    )

    const now = this.clock.now()
    const sortOrder = command.sortOrder ?? nextSortOrder(existing.map((o) => o.sortOrder))
    const impact = runDomain(createBusinessImpact, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      color: command.color,
      sortOrder,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.businessImpacts.add(impact)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'BusinessImpactCreated',
      organizationId,
      impact.id,
      `Business Impact '${impact.name}' created.`,
      now,
    )

    return toItem(impact)
  }

  async update(
    businessImpactId: string,
    command: UpdateBusinessImpactCommand,
  ): Promise<BusinessImpactItem> {
    const existingOption = await this.businessImpacts.getById(businessImpactId)
    if (existingOption === null) {
      throw new NotFoundError('Business Impact not found.')
    }
    this.ensureAdminScope(existingOption.organizationId)
    if (existingOption.isDeleted) {
      throw new NotFoundError('Business Impact not found.')
    }

    ensureValidColor(command.color)
    const existing = await this.businessImpacts.listByOrganization(
      existingOption.organizationId,
      false,
    )
    ensureNameAvailable(
      command.name,
      existing.map((o) => o.name),
      existingOption.name,
    )

    const now = this.clock.now()
    const impact = runDomain(
      updateBusinessImpact,
      existingOption,
      {
        name: command.name,
        color: command.color,
        sortOrder: command.sortOrder ?? existingOption.sortOrder,
      },
      now,
      this.currentUser.userId,
    )
    await this.businessImpacts.save(impact)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'BusinessImpactUpdated',
      impact.organizationId,
      impact.id,
      `Business Impact '${impact.name}' updated.`,
      now,
    )

    return toItem(impact)
  }

  /**
   * Replaces the complete active-option order atomically - every `save` below is staged and
   * committed with a single `unitOfWork.saveChanges()` after the loop (SPEC/decisions.md
   * 2026-09-06 "Wave B conventions").
   */
  async reorder(organizationId: string, orderedIds: readonly string[]): Promise<void> {
    this.ensureAdminScope(organizationId)

    const active = await this.businessImpacts.listByOrganization(organizationId, false)
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
      const updated = setBusinessImpactSortOrder(
        current,
        (index + 1) * SORT_ORDER_STEP,
        now,
        this.currentUser.userId,
      )
      await this.businessImpacts.save(updated)
    }

    await this.unitOfWork.saveChanges()
    await this.audit(
      'BusinessImpactsReordered',
      organizationId,
      organizationId,
      'Business Impact order updated.',
      now,
    )
  }

  async delete(businessImpactId: string): Promise<void> {
    const existing = await this.businessImpacts.getById(businessImpactId)
    if (existing === null) {
      throw new NotFoundError('Business Impact not found.')
    }
    this.ensureAdminScope(existing.organizationId)
    if (existing.isDeleted) {
      return
    }

    const activeCount = await this.businessImpacts.countActiveByOrganization(
      existing.organizationId,
    )
    if (activeCount <= MINIMUM_ACTIVE_BUSINESS_IMPACTS_PER_ORGANIZATION) {
      throw new ValidationError('One or more fields are invalid.', {
        businessImpact: [
          'An organization must keep at least one active Business Impact; this option cannot be deleted.',
        ],
      })
    }

    const now = this.clock.now()
    const impact = runDomain(softDeleteBusinessImpact, existing, now, this.currentUser.userId)
    await this.businessImpacts.save(impact)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'BusinessImpactDeleted',
      impact.organizationId,
      impact.id,
      `Business Impact '${impact.name}' soft-deleted.`,
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
      entityType: 'BusinessImpact',
      message,
      occurredAtUtc,
      organizationId,
      attribution,
      entityId,
      metadataJson: null,
    })
  }
}

function toItem(impact: BusinessImpact): BusinessImpactItem {
  return {
    businessImpactId: impact.id,
    organizationId: impact.organizationId,
    name: impact.name,
    color: impact.color,
    sortOrder: impact.sortOrder,
    isDeleted: impact.isDeleted,
  }
}

function ensureValidColor(color: string | null): void {
  if (!color || !HEX_COLOR_PATTERN.test(color.trim())) {
    throw new ValidationError('One or more fields are invalid.', {
      color: ['Color must be a valid #RRGGBB hex color.'],
    })
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
 * Wraps a domain transition so a `BusinessImpactDomainError` surfaces as a field-keyed
 * `ValidationError` instead of letting a bare `Error` become a 500, mirroring `runDomain` in
 * `../statuses/status-service.ts` (SPEC/decisions.md 2026-09-06 "Wave B conventions").
 *
 * UNREACHABLE BY CONSTRUCTION for every call site above, not a sign a precondition is missing -
 * see the identical note (and the reason) in `../idea-fields/idea-type-service.ts`.
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof BusinessImpactDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
