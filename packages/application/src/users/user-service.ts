import { randomUUID } from 'node:crypto'
import { Role, UserStatus } from '@collega/domain/enums'
import {
  administerUser,
  createOrganizationUser,
  generateTemporaryPassword,
  normalizeEmail,
  type User,
  UserDomainError,
  validatePassword,
} from '@collega/domain/users'
import type { PasswordHasher } from '../auth/ports.js'
import {
  ApplicationError,
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  ConflictError,
  type CurrentUserContext,
  ForbiddenError,
  MAX_PAGE_SIZE,
  NotFoundError,
  normalizePageRequest,
  type PageRequest,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type {
  CreateUserCommand,
  CreateUserResult,
  OrganizationMember,
  UpdateUserCommand,
  UserDetail,
  UserImportResult,
  UserImportRow,
  UserImportRowResult,
  UserListItem,
  UserListQuery,
  UserListResult,
} from './models.js'
import type { UserRepository } from './ports.js'

const VALIDATION_TITLE = 'One or more fields are invalid.'

/**
 * Wraps a domain transition so a `UserDomainError` (a plain-Error invariant violation - packages/
 * domain imports nothing, so it cannot throw the kernel's `ValidationError` itself) surfaces as a
 * proper field-level 400, mirroring how .NET's request-DTO validation attributes turned a blank
 * First/Last Name into the same shape before the domain was ever reached (ideas/idea.service.ts's
 * `runDomain` is the reference for this pattern).
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof UserDomainError) {
      throw new ValidationError(VALIDATION_TITLE, { [error.field]: [error.message] })
    }
    throw error
  }
}

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
 * User administration use cases (SPEC/20-feature-organizations-and-users.md "User Rules",
 * SPEC/30-Contracts.md "User Contracts"). Enforces organization scoping, one-org/one-role
 * (requirement #3-4), globally unique email (#6), Active/Inactive-only states (#10), and the
 * last-Org-Admin safeguard (#8).
 *
 * Direct user administration is the bootstrap exception (SPEC/20-feature-view-as.md rule 26):
 * `ensureNotDirectSiteAdmin` is deliberately never called anywhere in this file.
 */
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async listByOrganization(organizationId: string, query: UserListQuery): Promise<UserListResult> {
    await this.authorizeOrganizationScope(organizationId)

    const page = await this.users.listByOrganization({
      organizationId,
      page: normalizePageRequest(toPageRequestInput(query.page, query.pageSize)),
      search: query.search?.trim() ?? null,
      role: parseOptionalRole(query.role),
      status: parseOptionalStatus(query.status),
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

  async listAssignableMembers(organizationId: string): Promise<readonly OrganizationMember[]> {
    await this.authorizeOrganizationReadScope(organizationId)

    const members: OrganizationMember[] = []
    for (let page = 1; ; page++) {
      const result = await this.users.listByOrganization({
        organizationId,
        page: { page, pageSize: MAX_PAGE_SIZE },
        search: null,
        role: null,
        status: UserStatus.Active,
        sortBy: null,
        sortDirection: null,
      })

      for (const u of result.items) {
        members.push({ userId: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email })
      }

      if (members.length >= result.totalCount || result.items.length === 0) {
        return members
      }
    }
  }

  async create(organizationId: string, command: CreateUserCommand): Promise<CreateUserResult> {
    await this.authorizeOrganizationScope(organizationId)

    const now = this.clock.now()
    const role = parseAssignableRole(command.role)
    const status = parseStatus(command.status, UserStatus.Active) ?? UserStatus.Active

    const email = command.email ?? ''
    const normalizedEmail = normalizeEmail(email)
    if (normalizedEmail.length === 0) {
      throw new ValidationError(VALIDATION_TITLE, { email: ['Email is required.'] })
    }

    if (await this.users.existsByNormalizedEmail(normalizedEmail)) {
      throw new ConflictError('Email is already in use.')
    }

    const passwordErrors = validatePassword(command.initialPassword)
    if (passwordErrors.length > 0) {
      throw new ValidationError(VALIDATION_TITLE, { initialPassword: [...passwordErrors] })
    }

    const passwordHash = this.passwordHasher.hash(command.initialPassword)

    // An admin-provided initial credential forces a change on first login (auth requirement
    // #31).
    const user = runDomain(
      createOrganizationUser,
      {
        id: randomUUID(),
        organizationId,
        firstName: command.firstName,
        lastName: command.lastName,
        email,
        passwordHash,
        role,
        status,
        mustChangePassword: true,
      },
      now,
      this.currentUser.userId,
    )

    await this.users.add(user)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'UserCreated',
      organizationId,
      user.id,
      this.currentUser.userId,
      `User '${user.email}' created with role ${role}.`,
      now,
      { email: user.email, role, status },
    )

    return {
      userId: user.id,
      organizationId,
      email: user.email,
      role: user.role,
      status: user.status,
    }
  }

  async import(organizationId: string, rows: readonly UserImportRow[]): Promise<UserImportResult> {
    // Authorize once up front so an out-of-scope caller gets a single failure rather than
    // per-row failures.
    await this.authorizeOrganizationScope(organizationId)

    const results: UserImportRowResult[] = []
    let created = 0
    let rejected = 0

    for (const row of rows) {
      if (!row.firstName?.trim() || !row.lastName?.trim() || !row.email?.trim()) {
        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          outcome: 'rejected',
          error: 'First name, last name, and email are required.',
          temporaryPassword: null,
        })
        rejected++
        continue
      }

      // Each created user gets a policy-valid temporary password and must change it on first
      // login.
      const temporaryPassword = generateTemporaryPassword()
      try {
        const command: CreateUserCommand = {
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email.trim(),
          role: row.role?.trim() || Role.User,
          initialPassword: temporaryPassword,
          status: null,
        }

        await this.create(organizationId, command)
        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          outcome: 'created',
          error: null,
          temporaryPassword,
        })
        created++
      } catch (error) {
        // Mirrors the C# `catch (AppException ex)`: a business-rule rejection is reported per
        // row, but anything else is a real bug and must propagate rather than being swallowed.
        if (!(error instanceof ApplicationError)) {
          throw error
        }

        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          outcome: 'rejected',
          error: describeRowError(error),
          temporaryPassword: null,
        })
        rejected++
      }
    }

    return { createdCount: created, rejectedCount: rejected, rows: results }
  }

  async getById(userId: string): Promise<UserDetail> {
    const user = await this.loadInScope(userId)
    return toDetail(user)
  }

  async update(userId: string, command: UpdateUserCommand): Promise<UserDetail> {
    const user = await this.loadInScope(userId)
    const now = this.clock.now()

    const newRole = parseAssignableRole(command.role)
    const newStatus = parseStatus(command.status, null)
    if (newStatus === null) {
      throw new ValidationError(VALIDATION_TITLE, { status: [allowedStatusMessage()] })
    }

    // Email uniqueness is enforced only when the address actually changes (requirement #6).
    const newEmail = command.email ?? ''
    const newNormalizedEmail = normalizeEmail(newEmail)
    if (newNormalizedEmail.length === 0) {
      throw new ValidationError(VALIDATION_TITLE, { email: ['Email is required.'] })
    }

    if (
      newNormalizedEmail !== user.normalizedEmail &&
      (await this.users.existsByNormalizedEmail(newNormalizedEmail))
    ) {
      throw new ConflictError('Email is already in use.')
    }

    await this.enforceLastOrgAdminSafeguard(user, newRole, newStatus)

    const previousRole = user.role
    const previousStatus = user.status

    const updated = runDomain(
      administerUser,
      user,
      {
        firstName: command.firstName,
        lastName: command.lastName,
        email: newEmail,
        role: newRole,
        status: newStatus,
      },
      now,
      this.currentUser.userId,
    )
    await this.users.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'UserUpdated',
      updated.organizationId,
      updated.id,
      this.currentUser.userId,
      `User '${updated.email}' updated.`,
      now,
      {
        roleChanged: previousRole !== newRole,
        statusChanged: previousStatus !== newStatus,
        role: newRole,
        status: newStatus,
      },
    )

    return toDetail(updated)
  }

  /** Requirement #8: the last Org Admin cannot remove their own admin role or deactivate
   * themselves. Scoped to self-action - a Site Admin may still change the last Org Admin. */
  private async enforceLastOrgAdminSafeguard(
    target: User,
    newRole: Role,
    newStatus: UserStatus,
  ): Promise<void> {
    const actingOnSelf = this.currentUser.userId === target.id
    const organizationId = target.organizationId
    if (!actingOnSelf || target.role !== Role.OrgAdmin || organizationId === null) {
      return
    }

    const losingAdmin = newRole !== Role.OrgAdmin
    const deactivating = newStatus !== UserStatus.Active
    if (!losingAdmin && !deactivating) {
      return
    }

    const otherActiveAdmins = await this.users.countActiveOrgAdmins(organizationId, target.id)
    if (otherActiveAdmins > 0) {
      return
    }

    if (losingAdmin) {
      throw new ValidationError(VALIDATION_TITLE, {
        role: [
          'You cannot remove your own Org Admin role because you are the last Org Admin in this organization.',
        ],
      })
    }

    throw new ValidationError(VALIDATION_TITLE, {
      status: [
        'You cannot deactivate yourself because you are the last Org Admin in this organization.',
      ],
    })
  }

  /** Verifies the caller may administer users in the target organization; not-found if it does
   * not exist or is outside their scope. */
  private async authorizeOrganizationScope(organizationId: string): Promise<void> {
    const role = this.requireAuthenticatedRole()

    if (role === Role.SiteAdmin) {
      return
    }

    if (role === Role.OrgAdmin && this.currentUser.organizationId === organizationId) {
      return
    }

    if (role === Role.OrgAdmin) {
      // An Org Admin targeting another org is told the org does not exist in their scope.
      throw new NotFoundError('Organization not found.')
    }

    throw new ForbiddenError('You are not allowed to manage users in this organization.')
  }

  /**
   * Read-only membership scope for listing assignable members. Broader than
   * `authorizeOrganizationScope`: any authenticated caller bound to the target organization (Org
   * Admin, User, or Read Only) may read its members, and a Site Admin may read any organization.
   * A caller outside the organization gets a not-found rather than leaking existence.
   */
  private async authorizeOrganizationReadScope(organizationId: string): Promise<void> {
    const role = this.requireAuthenticatedRole()

    if (role === Role.SiteAdmin) {
      return
    }

    if (this.currentUser.organizationId === organizationId) {
      return
    }

    throw new NotFoundError('Organization not found.')
  }

  /** Loads a user the caller may view/administer, or not-found if it is outside their scope. */
  private async loadInScope(userId: string): Promise<User> {
    const role = this.requireAuthenticatedRole()

    const user = await this.users.getById(userId)
    if (!user) {
      throw new NotFoundError('User not found.')
    }

    if (role === Role.SiteAdmin) {
      return user
    }

    if (
      role === Role.OrgAdmin &&
      user.organizationId !== null &&
      user.organizationId === this.currentUser.organizationId
    ) {
      return user
    }

    if (role === Role.OrgAdmin) {
      throw new NotFoundError('User not found.')
    }

    throw new ForbiddenError('You are not allowed to manage this user.')
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    organizationId: string | null,
    entityId: string,
    actorUserId: string | null,
    message: string,
    nowUtc: Date,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    await this.auditEvents.write({
      eventType,
      entityType: 'User',
      message,
      occurredAtUtc: nowUtc,
      organizationId,
      entityId,
      metadataJson: metadata === null ? null : JSON.stringify(metadata),
      attribution: attributeAudit(this.currentUser, actorUserId),
    })
  }
}

function describeRowError(error: ApplicationError): string {
  if (error instanceof ValidationError) {
    return Object.values(error.failures).flat().join(' ')
  }
  return error.message
}

function parseAssignableRole(value: string | null | undefined): Role {
  // Site Admin is a global platform account that cannot be assigned to an organization user.
  const candidate = value?.trim()
  const role = Object.values(Role).find((r) => r.toLowerCase() === candidate?.toLowerCase())
  if (role !== undefined && role !== Role.SiteAdmin) {
    return role
  }

  throw new ValidationError(VALIDATION_TITLE, {
    role: [`Role must be one of: ${Role.OrgAdmin}, ${Role.User}, ${Role.ReadOnly}.`],
  })
}

function parseOptionalRole(value: string | null | undefined): Role | null {
  const candidate = value?.trim()
  if (!candidate) {
    return null
  }
  return Object.values(Role).find((r) => r.toLowerCase() === candidate.toLowerCase()) ?? null
}

function parseStatus(
  value: string | null | undefined,
  defaultStatus: UserStatus | null,
): UserStatus | null {
  const candidate = value?.trim()
  if (!candidate) {
    return defaultStatus
  }

  const status = Object.values(UserStatus).find((s) => s.toLowerCase() === candidate.toLowerCase())
  if (status === undefined) {
    throw new ValidationError(VALIDATION_TITLE, { status: [allowedStatusMessage()] })
  }
  return status
}

function parseOptionalStatus(value: string | null | undefined): UserStatus | null {
  const candidate = value?.trim()
  if (!candidate) {
    return null
  }
  return Object.values(UserStatus).find((s) => s.toLowerCase() === candidate.toLowerCase()) ?? null
}

function allowedStatusMessage(): string {
  return `Status must be one of: ${UserStatus.Active}, ${UserStatus.Inactive}.`
}

function toListItem(u: User): UserListItem {
  return {
    userId: u.id,
    organizationId: u.organizationId,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    status: u.status,
  }
}

function toDetail(u: User): UserDetail {
  return {
    userId: u.id,
    organizationId: u.organizationId,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    createdAtUtc: u.createdAtUtc,
    updatedAtUtc: u.updatedAtUtc,
  }
}
