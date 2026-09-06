import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import {
  archiveOrganization,
  clearOrganizationLogo,
  createOrganization,
  normalizeInviteCode,
  ORGANIZATION_LOGO_THUMBNAIL_MAX_LENGTH,
  type Organization,
  regenerateInviteCode,
  setOrganizationLogo,
  updateOrganization,
} from '@collega/domain/organizations'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  normalizePageRequest,
  type PageRequest,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type {
  CreateOrganizationCommand,
  CreateOrganizationResult,
  OrganizationDetail,
  OrganizationListItem,
  OrganizationListQuery,
  OrganizationListResult,
  OrganizationProfileFields,
  RegenerateInviteCodeResult,
  SetLogoCommand,
  UpdateOrganizationCommand,
} from './models.js'
import type {
  InviteCodeGenerator,
  OrganizationBootstrapPort,
  OrganizationRepository,
  UnitOfWork,
} from './ports.js'

const INVITE_CODE_GENERATION_ATTEMPTS = 10

// `exactOptionalPropertyTypes` refuses `{ page: number | undefined }` for an optional `page?:
// number` - the key must be absent, not present-with-undefined - so a query's nullable fields
// are translated into present-or-absent keys rather than passed straight through.
function toPageRequestInput(page: number | null, pageSize: number | null): Partial<PageRequest> {
  return {
    ...(page !== null ? { page } : {}),
    ...(pageSize !== null ? { pageSize } : {}),
  }
}

/**
 * Organization administration use cases (SPEC/20-feature-organizations-and-users.md,
 * SPEC/30-Contracts.md "Organization Contracts"). Authorization and organization scoping are
 * enforced here, never at the API boundary.
 *
 * Organization creation is the bootstrap exception (SPEC/20-feature-view-as.md rule 26): a Site
 * Admin acting as themselves creates organizations directly, so `ensureNotDirectSiteAdmin` is
 * deliberately never called anywhere in this file.
 */
export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly bootstrap: OrganizationBootstrapPort,
    private readonly inviteCodeGenerator: InviteCodeGenerator,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEventWriter: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(query: OrganizationListQuery): Promise<OrganizationListResult> {
    this.requireSiteAdmin()

    const page = await this.organizations.list({
      page: normalizePageRequest(toPageRequestInput(query.page, query.pageSize)),
      search: query.search?.trim() ?? null,
      includeArchived: query.includeArchived,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    })

    return {
      items: page.items.map(toListItem),
      page: page.page,
      pageSize: page.pageSize,
      totalCount: page.totalCount,
      sortBy: page.sortBy,
      sortDirection: page.sortDirection,
    }
  }

  async create(command: CreateOrganizationCommand): Promise<CreateOrganizationResult> {
    this.requireSiteAdmin()

    const now = this.clock.now()
    const actorUserId = this.currentUser.userId
    const inviteCode = await this.generateUniqueInviteCode()

    const organization = createOrganization(
      {
        id: randomUUID(),
        title: command.title,
        description: command.description,
        inviteCode,
        logoUrl: command.logoUrl,
        profile: toDomainProfile(command.profile),
      },
      now,
      actorUserId,
    )

    await this.organizations.add(organization)

    // Rule #10: a newly created organization starts with the default statuses and one default
    // board. Provisioned within the same unit of work so an org is never left half-created.
    const provisioned = await this.bootstrap.provisionDefaults(organization.id, now, actorUserId)

    await this.unitOfWork.saveChanges()

    await this.audit(
      'OrganizationCreated',
      organization.id,
      actorUserId,
      `Organization '${organization.title}' created.`,
      now,
      {
        title: organization.title,
        defaultStatusCount: provisioned.defaultStatusCount,
        defaultBoardId: provisioned.defaultBoardId,
      },
    )

    return {
      organizationId: organization.id,
      inviteCode: organization.inviteCode,
      defaultBoardId: provisioned.defaultBoardId,
      defaultStatusCount: provisioned.defaultStatusCount,
    }
  }

  async getById(organizationId: string): Promise<OrganizationDetail> {
    const organization = await this.loadForAdministration(organizationId)
    return toDetail(organization)
  }

  async update(
    organizationId: string,
    command: UpdateOrganizationCommand,
  ): Promise<OrganizationDetail> {
    const organization = await this.loadForAdministration(organizationId)
    const now = this.clock.now()

    const updated = updateOrganization(
      organization,
      {
        title: command.title,
        description: command.description,
        logoUrl: command.logoUrl,
        profile: toDomainProfile(command.profile),
      },
      now,
      this.currentUser.userId,
    )
    await this.organizations.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'OrganizationUpdated',
      updated.id,
      this.currentUser.userId,
      `Organization '${updated.title}' updated.`,
      now,
      null,
    )

    return toDetail(updated)
  }

  async regenerateInviteCode(organizationId: string): Promise<RegenerateInviteCodeResult> {
    const organization = await this.loadForAdministration(organizationId)
    const now = this.clock.now()

    const newCode = await this.generateUniqueInviteCode()
    const updated = regenerateInviteCode(organization, newCode, now, this.currentUser.userId)
    await this.organizations.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'OrganizationInviteCodeRegenerated',
      updated.id,
      this.currentUser.userId,
      'Organization invite code regenerated.',
      now,
      null,
    )

    return { inviteCode: updated.inviteCode }
  }

  async setLogo(organizationId: string, command: SetLogoCommand): Promise<OrganizationDetail> {
    const organization = await this.loadForAdministration(organizationId)

    // Validate here so bad client input is a validation error rather than an unhandled domain
    // exception.
    const dataUri = command.thumbnailDataUri
    if (
      !dataUri ||
      dataUri.trim().length === 0 ||
      !dataUri.toLowerCase().startsWith('data:image/')
    ) {
      throw new ValidationError('Validation failed.', {
        thumbnailDataUri: ['Logo must be an image.'],
      })
    }

    if (dataUri.length > ORGANIZATION_LOGO_THUMBNAIL_MAX_LENGTH) {
      throw new ValidationError('Validation failed.', {
        thumbnailDataUri: ['Logo image is too large.'],
      })
    }

    const now = this.clock.now()
    const updated = setOrganizationLogo(
      organization,
      dataUri,
      command.heightPx,
      now,
      this.currentUser.userId,
    )
    await this.organizations.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'OrganizationLogoUpdated',
      updated.id,
      this.currentUser.userId,
      `Organization '${updated.title}' logo updated.`,
      now,
      null,
    )

    return toDetail(updated)
  }

  async clearLogo(organizationId: string): Promise<OrganizationDetail> {
    const organization = await this.loadForAdministration(organizationId)
    const now = this.clock.now()

    const updated = clearOrganizationLogo(organization, now, this.currentUser.userId)
    await this.organizations.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'OrganizationLogoCleared',
      updated.id,
      this.currentUser.userId,
      `Organization '${updated.title}' logo removed.`,
      now,
      null,
    )

    return toDetail(updated)
  }

  async archive(organizationId: string): Promise<void> {
    // Only Site Admin can archive an organization (org-and-users requirement #8).
    this.requireSiteAdmin()

    const organization = await this.organizations.getById(organizationId)
    if (!organization) {
      throw new NotFoundError('Organization not found.')
    }

    const now = this.clock.now()
    const archived = archiveOrganization(organization, now, this.currentUser.userId)
    await this.organizations.update(archived)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'OrganizationArchived',
      archived.id,
      this.currentUser.userId,
      `Organization '${archived.title}' archived.`,
      now,
      null,
    )
  }

  /**
   * Loads an organization the caller is allowed to administer. Site Admin may administer any;
   * Org Admin only their own (a different org is reported as not-found to avoid leaking
   * existence); User and Read Only are forbidden.
   */
  private async loadForAdministration(organizationId: string): Promise<Organization> {
    const role = this.requireAuthenticatedRole()

    if (role !== Role.SiteAdmin && role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to administer organizations.')
    }

    if (role === Role.OrgAdmin && this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }

    const organization = await this.organizations.getById(organizationId)
    if (!organization) {
      throw new NotFoundError('Organization not found.')
    }

    return organization
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < INVITE_CODE_GENERATION_ATTEMPTS; attempt++) {
      // Normalized here too so the uniqueness probe uses the same canonical form the entity
      // stores.
      const candidate = normalizeInviteCode(this.inviteCodeGenerator.generate())
      if (!(await this.organizations.inviteCodeExists(candidate))) {
        return candidate
      }
    }

    throw new Error('Unable to generate a unique organization invite code.')
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    return this.currentUser.role
  }

  private requireSiteAdmin(): void {
    if (this.requireAuthenticatedRole() !== Role.SiteAdmin) {
      throw new ForbiddenError('Only a Site Admin can perform this action.')
    }
  }

  private async audit(
    eventType: string,
    organizationId: string,
    actorUserId: string | null,
    message: string,
    nowUtc: Date,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    await this.auditEventWriter.write({
      eventType,
      entityType: 'Organization',
      message,
      occurredAtUtc: nowUtc,
      organizationId,
      entityId: organizationId,
      metadataJson: metadata === null ? null : JSON.stringify(metadata),
      attribution: attributeAudit(this.currentUser, actorUserId),
    })
  }
}

function toDomainProfile(profile: OrganizationProfileFields) {
  return {
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    phone: profile.phone,
    primaryContactFirstName: profile.primaryContactFirstName,
    primaryContactLastName: profile.primaryContactLastName,
  }
}

function toListItem(o: Organization): OrganizationListItem {
  return {
    organizationId: o.id,
    title: o.title,
    description: o.description,
    inviteCode: o.inviteCode,
    city: o.city,
    state: o.state,
    phone: o.phone,
    logoThumbnailUrl: o.logoThumbnailUrl,
    isArchived: o.isArchived,
  }
}

function toDetail(o: Organization): OrganizationDetail {
  return {
    organizationId: o.id,
    title: o.title,
    description: o.description,
    inviteCode: o.inviteCode,
    logoUrl: o.logoUrl,
    logoThumbnailUrl: o.logoThumbnailUrl,
    logoHeightPx: o.logoHeightPx,
    address: o.address,
    city: o.city,
    state: o.state,
    zip: o.zip,
    phone: o.phone,
    primaryContactFirstName: o.primaryContactFirstName,
    primaryContactLastName: o.primaryContactLastName,
    isArchived: o.isArchived,
    createdAtUtc: o.createdAtUtc,
    updatedAtUtc: o.updatedAtUtc,
  }
}
