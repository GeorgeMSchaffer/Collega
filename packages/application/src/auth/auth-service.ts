import { randomUUID } from 'node:crypto'
import { Role, UserStatus } from '@collega/domain/enums'
import { normalizeInviteCode } from '@collega/domain/organizations'
import {
  changeUserPassword,
  createOrganizationUser,
  generateTemporaryPassword,
  issueTemporaryPassword as issueUserTemporaryPassword,
  isTemporaryPasswordExpired,
  isUserLockedOut,
  normalizeEmail,
  registerFailedLoginAttempt,
  registerSuccessfulLogin,
  removeUserPortrait,
  setUserPortrait,
  type User,
  UserDomainError,
  updateUserName,
  validatePassword,
} from '@collega/domain/users'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  LockedOutError,
  NotFoundError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type { OrganizationRepository } from '../organizations/ports.js'
import type { UserRepository } from '../users/ports.js'
import type {
  ChangePasswordCommand,
  CurrentUserSummary,
  LoginCommand,
  LoginResult,
  RegisterCommand,
  RegisterResult,
  TemporaryPasswordResult,
  UpdateProfileCommand,
} from './models.js'
import type { AccessTokenIssuer, ImageProcessor, PasswordHasher } from './ports.js'

// <=25px on either side, per the portrait-upload requirement.
const PORTRAIT_MAX_DIMENSION = 25
const VALIDATION_TITLE = 'One or more fields are invalid.'

/**
 * Wraps a domain transition so a `UserDomainError` (a plain-Error invariant violation - packages/
 * domain imports nothing, so it cannot throw the kernel's `ValidationError` itself) surfaces as a
 * proper field-level 400, mirroring how .NET's request-DTO validation attributes turned a blank
 * First/Last Name into the same shape before the domain was ever reached (ideas/idea.service.ts's
 * `runDomain` is the reference for this pattern; users/user-service.ts carries the same helper for
 * the same reason - each file that calls into a User domain transition needs its own).
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

/**
 * Auth slice use cases (SPEC/20-feature-auth.md). Authorization for `issueTemporaryPassword` and
 * identity resolution for the "self" endpoints are resolved from the injected
 * `CurrentUserContext`, not passed in by the caller.
 */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly organizations: OrganizationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: AccessTokenIssuer,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly imageProcessor: ImageProcessor,
    private readonly clock: Clock,
  ) {}

  async login(command: LoginCommand): Promise<LoginResult> {
    const now = this.clock.now()
    const normalizedEmail = normalizeEmail(command.email ?? '')
    const user = await this.users.getByNormalizedEmail(normalizedEmail)

    if (!user) {
      await this.audit(
        'AuthLoginFailed',
        null,
        null,
        null,
        'Login failed: no account found for the provided email.',
        now,
        { email: normalizedEmail },
      )
      throw new UnauthorizedError('Invalid email or password.')
    }

    // Inactive accounts are denied outright (auth requirement #15), ahead of lockout/password
    // checks, so a deactivated account never leaks lockout state or accepts a correct password.
    if (user.status !== UserStatus.Active) {
      await this.audit(
        'AuthLoginFailed',
        user.organizationId,
        user.id,
        null,
        'Login failed: account is inactive.',
        now,
        { reason: 'Inactive' },
      )
      throw new ForbiddenError('This account is inactive.')
    }

    if (isUserLockedOut(user, now)) {
      await this.audit(
        'AuthLoginFailed',
        user.organizationId,
        user.id,
        null,
        'Login failed: account is locked out.',
        now,
        { reason: 'LockedOut' },
      )
      throw new LockedOutError(
        'This account is locked due to too many failed login attempts. Try again in 15 minutes.',
      )
    }

    // An admin-issued temporary password that has expired unused (auth requirement #13) is
    // treated as an invalid credential even if the hash still matches.
    const credentialIsUsable = !isTemporaryPasswordExpired(user, now)
    const passwordMatches =
      credentialIsUsable && this.passwordHasher.verify(command.password ?? '', user.passwordHash)

    if (!passwordMatches) {
      const afterFailure = registerFailedLoginAttempt(user, now)
      await this.users.update(afterFailure)
      await this.unitOfWork.saveChanges()

      if (isUserLockedOut(afterFailure, now)) {
        await this.audit(
          'AuthLoginFailed',
          user.organizationId,
          user.id,
          null,
          'Login failed: incorrect password (account now locked out).',
          now,
          { reason: 'LockedOut' },
        )
        throw new LockedOutError(
          'This account is locked due to too many failed login attempts. Try again in 15 minutes.',
        )
      }

      await this.audit(
        'AuthLoginFailed',
        user.organizationId,
        user.id,
        null,
        'Login failed: incorrect password.',
        now,
        { reason: 'InvalidPassword' },
      )
      throw new UnauthorizedError('Invalid email or password.')
    }

    const loggedIn = registerSuccessfulLogin(user, now)
    await this.users.update(loggedIn)
    await this.unitOfWork.saveChanges()

    const token = this.tokenIssuer.issue(loggedIn.id, loggedIn.securityStamp, now)

    await this.audit(
      'AuthLoginSucceeded',
      loggedIn.organizationId,
      loggedIn.id,
      loggedIn.id,
      'Login succeeded.',
      now,
      null,
    )

    return {
      accessToken: token.token,
      expiresInSeconds: token.expiresInSeconds,
      requiresPasswordChange: loggedIn.mustChangePassword,
      user: toSummary(loggedIn, await this.organizationTitle(loggedIn)),
    }
  }

  async getCurrentUser(userId: string): Promise<CurrentUserSummary> {
    const user = await this.users.getById(userId)
    if (!user) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    return toSummary(user, await this.organizationTitle(user))
  }

  /** Self-service update of the caller's own first/last name (auth requirement #20). */
  async updateProfile(command: UpdateProfileCommand): Promise<CurrentUserSummary> {
    const now = this.clock.now()
    const user = await this.requireCurrentUser()

    // Names are validated for shape at the API boundary; the domain function trims and enforces
    // non-empty.
    const updated = runDomain(
      updateUserName,
      user,
      command.firstName,
      command.lastName,
      now,
      user.id,
    )
    await this.users.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'UserProfileUpdated',
      updated.organizationId,
      updated.id,
      updated.id,
      'User updated their profile name.',
      now,
      null,
    )

    return toSummary(updated, await this.organizationTitle(updated))
  }

  /** Validates raw uploaded image bytes through the image pipeline (reject non-images /
   * disguised content), resizes to the portrait thumbnail, and stores it on the caller's
   * record. */
  async updatePortrait(imageBytes: Uint8Array): Promise<CurrentUserSummary> {
    const now = this.clock.now()
    const user = await this.requireCurrentUser()

    if (imageBytes.length === 0) {
      throw new ValidationError(VALIDATION_TITLE, {
        portrait: ['Choose an image file to upload.'],
      })
    }

    // Security boundary: the bytes are decoded through a real image codec. Content that isn't a
    // genuine GIF/JPEG/PNG - including a disguised text/executable payload with an image name or
    // MIME type - comes back null and is rejected here, never persisted.
    const thumbnail = await this.imageProcessor.tryCreatePngThumbnail(
      imageBytes,
      PORTRAIT_MAX_DIMENSION,
    )
    if (!thumbnail) {
      throw new ValidationError(VALIDATION_TITLE, {
        portrait: ["That file isn't a supported image. Upload a GIF, JPEG, or PNG."],
      })
    }

    const updated = runDomain(setUserPortrait, user, thumbnail, now, user.id)
    await this.users.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'UserPortraitUpdated',
      updated.organizationId,
      updated.id,
      updated.id,
      'User updated their profile portrait.',
      now,
      null,
    )

    return toSummary(updated, await this.organizationTitle(updated))
  }

  /** Clears the caller's stored portrait so the initials avatar is shown again. */
  async removePortrait(): Promise<CurrentUserSummary> {
    const now = this.clock.now()
    const user = await this.requireCurrentUser()

    const updated = removeUserPortrait(user, now, user.id)
    await this.users.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'UserPortraitRemoved',
      updated.organizationId,
      updated.id,
      updated.id,
      'User removed their profile portrait.',
      now,
      null,
    )

    return toSummary(updated, await this.organizationTitle(updated))
  }

  async changePassword(command: ChangePasswordCommand): Promise<void> {
    const now = this.clock.now()
    const user = await this.requireCurrentUser()

    if (!this.passwordHasher.verify(command.currentPassword ?? '', user.passwordHash)) {
      await this.audit(
        'AuthPasswordChangeFailed',
        user.organizationId,
        user.id,
        user.id,
        'Password change failed: current password is incorrect.',
        now,
        null,
      )
      throw new UnauthorizedError('Current password is incorrect.')
    }

    const errors = validatePassword(command.newPassword)
    if (errors.length > 0) {
      throw new ValidationError(VALIDATION_TITLE, { newPassword: [...errors] })
    }

    const newHash = this.passwordHasher.hash(command.newPassword)
    const updated = changeUserPassword(user, newHash, now)
    await this.users.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'AuthPasswordChanged',
      updated.organizationId,
      updated.id,
      updated.id,
      'Password changed successfully.',
      now,
      null,
    )
  }

  async register(command: RegisterCommand): Promise<RegisterResult> {
    const now = this.clock.now()
    const inviteCode = normalizeInviteCode(command.inviteCode)

    if (inviteCode.length === 0) {
      throw new ValidationError(VALIDATION_TITLE, { inviteCode: ['Invite code is required.'] })
    }

    const organization = await this.organizations.getByInviteCode(inviteCode)

    // Archived organizations' invite codes are invalid (org-and-users requirement #9); surfaced
    // identically to "unknown code" so the API doesn't leak archive state to an anonymous caller.
    if (!organization || organization.isArchived) {
      throw new ValidationError(VALIDATION_TITLE, {
        inviteCode: ['Invite code is invalid. Please provide a valid organization invite code.'],
      })
    }

    // Before the email check, not after, and that order is the security property: a probe now
    // costs a request carrying a policy-valid password rather than any request at all.
    const passwordErrors = validatePassword(command.password)
    if (passwordErrors.length > 0) {
      throw new ValidationError(VALIDATION_TITLE, { password: [...passwordErrors] })
    }

    const email = command.email ?? ''
    const normalizedEmail = normalizeEmail(email)
    if (await this.users.existsByNormalizedEmail(normalizedEmail)) {
      // Surfaced as a generic refusal, for the same reason the archived organization above is
      // surfaced as "unknown code", and the sameness is deliberate - DO NOT make this specific
      // again. `users.normalized_email` is globally unique, so this check spans every tenant:
      // a distinguishable "Email is already in use." let anyone holding one organization's
      // invite code enumerate accounts across all of them, Site Admins included, while
      // unauthenticated (SPEC/decisions.md 2026-09-10).
      //
      // The real reason is not lost, only moved off the wire - an operator reads it here.
      await this.audit(
        'UserSelfRegistrationRejected',
        organization.id,
        null,
        null,
        'Self-registration rejected: the email address is already in use.',
        now,
        { reason: 'EmailInUse', email: normalizedEmail },
      )
      throw new ValidationError(VALIDATION_TITLE, {
        email: ['We could not create an account with those details.'],
      })
    }

    const passwordHash = this.passwordHasher.hash(command.password)

    // Self-registered users always get role User / status Active (auth requirement #17,
    // org-and-users requirement #4) and are not forced to change their own chosen password.
    const user = runDomain(
      createOrganizationUser,
      {
        id: randomUUID(),
        organizationId: organization.id,
        firstName: command.firstName,
        lastName: command.lastName,
        email,
        passwordHash,
        role: Role.User,
        status: UserStatus.Active,
        mustChangePassword: false,
      },
      now,
    )

    await this.users.add(user)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'UserSelfRegistered',
      organization.id,
      user.id,
      user.id,
      'User self-registered using an organization invite code.',
      now,
      null,
    )

    return {
      userId: user.id,
      organizationId: organization.id,
      email: user.email,
      role: user.role,
      status: user.status,
    }
  }

  async issueTemporaryPassword(targetUserId: string): Promise<TemporaryPasswordResult> {
    const now = this.clock.now()

    if (
      !this.currentUser.isAuthenticated ||
      this.currentUser.userId === null ||
      this.currentUser.role === null
    ) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    const targetUser = await this.users.getById(targetUserId)
    if (!targetUser) {
      throw new NotFoundError('User not found.')
    }

    const isSiteAdmin = this.currentUser.role === Role.SiteAdmin
    const isOrgAdminForTarget =
      this.currentUser.role === Role.OrgAdmin &&
      this.currentUser.organizationId !== null &&
      targetUser.organizationId !== null &&
      this.currentUser.organizationId === targetUser.organizationId

    if (!isSiteAdmin && !isOrgAdminForTarget) {
      throw new ForbiddenError('You are not allowed to issue a temporary password for this user.')
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = this.passwordHasher.hash(temporaryPassword)
    const updated = issueUserTemporaryPassword(
      targetUser,
      passwordHash,
      now,
      this.currentUser.userId,
    )
    await this.users.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'AuthTemporaryPasswordIssued',
      updated.organizationId,
      updated.id,
      this.currentUser.userId,
      'An administrator issued a temporary password for this account.',
      now,
      null,
    )

    // Plaintext value is returned exactly once and is never persisted or logged.
    return { temporaryPassword, mustChangePassword: true }
  }

  /**
   * Resolves the caller's own identity from the injected `CurrentUserContext`, then loads that
   * record. The self-service mutations above take no user id parameter on purpose: the previous
   * `requireUser(userId)` only checked that the requested row existed, so a caller-supplied id
   * would have let any authenticated request rename, re-portrait, or change the password of any
   * other user. `issueTemporaryPassword` is the reference for resolving identity this way.
   *
   * While a View As session is live `currentUser.userId` is the impersonated user, which is the
   * correct target for a self-service edit - authorship records the target, not the real
   * administrator (SPEC/20-feature-view-as.md rules 4 and 15).
   */
  private async requireCurrentUser(): Promise<User> {
    if (!this.currentUser.isAuthenticated || this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    const user = await this.users.getById(this.currentUser.userId)
    if (!user) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return user
  }

  /**
   * The title of the user's organization, or `null` when they belong to none.
   *
   * One read on the endpoint the client already calls once per request, which is the point: the
   * sidebar names the organization on every authenticated page, and the alternative it replaces
   * was a second HTTP call to `GET /organizations/{id}` - an endpoint only a Site Admin or an
   * in-scope Org Admin may reach, so a `User` or `ReadOnly` reader paid a guaranteed 403 for it
   * and got no name (SPEC/decisions.md 2026-09-10).
   */
  private async organizationTitle(user: User): Promise<string | null> {
    if (user.organizationId === null) {
      return null
    }
    const organization = await this.organizations.getById(user.organizationId)
    return organization?.title ?? null
  }

  private async audit(
    eventType: string,
    organizationId: string | null,
    entityId: string | null,
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

function toSummary(user: User, organizationTitle: string | null): CurrentUserSummary {
  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationTitle,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    portraitDataUrl:
      user.portraitPng && user.portraitPng.length > 0
        ? `data:image/png;base64,${Buffer.from(user.portraitPng).toString('base64')}`
        : null,
    viewingAs: null,
  }
}
