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
  updateUserName,
  validatePassword,
} from '@collega/domain/users'
import {
  attributeAudit,
  ConflictError,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type { OrganizationRepository } from '../organizations/ports.js'
import type { UserRepository } from '../users/ports.js'
import { LockedOutError } from './errors.js'
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
import type {
  AccessTokenIssuer,
  AuditEventWriter,
  Clock,
  ImageProcessor,
  PasswordHasher,
  UnitOfWork,
} from './ports.js'

// <=25px on either side, per the portrait-upload requirement.
const PORTRAIT_MAX_DIMENSION = 25

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
    private readonly auditEventWriter: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly imageProcessor: ImageProcessor,
    private readonly clock: Clock,
  ) {}

  async login(command: LoginCommand): Promise<LoginResult> {
    const now = this.clock.utcNow
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
      user: toSummary(loggedIn),
    }
  }

  async getCurrentUser(userId: string): Promise<CurrentUserSummary> {
    const user = await this.users.getById(userId)
    if (!user) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    return toSummary(user)
  }

  /** Self-service update of the caller's own first/last name (auth requirement #20). */
  async updateProfile(userId: string, command: UpdateProfileCommand): Promise<CurrentUserSummary> {
    const now = this.clock.utcNow
    const user = await this.requireUser(userId)

    // Names are validated for shape at the API boundary; the domain function trims and enforces
    // non-empty.
    const updated = updateUserName(user, command.firstName, command.lastName, now, user.id)
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

    return toSummary(updated)
  }

  /** Validates raw uploaded image bytes through the image pipeline (reject non-images /
   * disguised content), resizes to the portrait thumbnail, and stores it on the caller's
   * record. */
  async updatePortrait(userId: string, imageBytes: Uint8Array): Promise<CurrentUserSummary> {
    const now = this.clock.utcNow
    const user = await this.requireUser(userId)

    if (imageBytes.length === 0) {
      throw new ValidationError('Validation failed.', {
        portrait: ['Choose an image file to upload.'],
      })
    }

    // Security boundary: the bytes are decoded through a real image codec. Content that isn't a
    // genuine GIF/JPEG/PNG - including a disguised text/executable payload with an image name or
    // MIME type - comes back null and is rejected here, never persisted.
    const thumbnail = this.imageProcessor.tryCreatePngThumbnail(imageBytes, PORTRAIT_MAX_DIMENSION)
    if (!thumbnail) {
      throw new ValidationError('Validation failed.', {
        portrait: ["That file isn't a supported image. Upload a GIF, JPEG, or PNG."],
      })
    }

    const updated = setUserPortrait(user, thumbnail, now, user.id)
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

    return toSummary(updated)
  }

  /** Clears the caller's stored portrait so the initials avatar is shown again. */
  async removePortrait(userId: string): Promise<CurrentUserSummary> {
    const now = this.clock.utcNow
    const user = await this.requireUser(userId)

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

    return toSummary(updated)
  }

  async changePassword(userId: string, command: ChangePasswordCommand): Promise<void> {
    const now = this.clock.utcNow
    const user = await this.requireUser(userId)

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
      throw new ValidationError('Validation failed.', { newPassword: [...errors] })
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
    const now = this.clock.utcNow
    const inviteCode = normalizeInviteCode(command.inviteCode)

    if (inviteCode.length === 0) {
      throw new ValidationError('Validation failed.', { inviteCode: ['Invite code is required.'] })
    }

    const organization = await this.organizations.getByInviteCode(inviteCode)

    // Archived organizations' invite codes are invalid (org-and-users requirement #9); surfaced
    // identically to "unknown code" so the API doesn't leak archive state to an anonymous caller.
    if (!organization || organization.isArchived) {
      throw new ValidationError('Validation failed.', {
        inviteCode: ['Invite code is invalid. Please provide a valid organization invite code.'],
      })
    }

    const email = command.email ?? ''
    const normalizedEmail = normalizeEmail(email)
    if (await this.users.existsByNormalizedEmail(normalizedEmail)) {
      throw new ConflictError('Email is already in use.')
    }

    const passwordErrors = validatePassword(command.password)
    if (passwordErrors.length > 0) {
      throw new ValidationError('Validation failed.', { password: [...passwordErrors] })
    }

    const passwordHash = this.passwordHasher.hash(command.password)

    // Self-registered users always get role User / status Active (auth requirement #17,
    // org-and-users requirement #4) and are not forced to change their own chosen password.
    const user = createOrganizationUser(
      {
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
    const now = this.clock.utcNow

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

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.getById(userId)
    if (!user) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return user
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
    const metadataJson = metadata === null ? null : JSON.stringify(metadata)
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    const attribution = attributeAudit(this.currentUser, actorUserId)
    await this.auditEventWriter.write({
      eventType,
      entityType: 'User',
      message,
      occurredAtUtc: nowUtc,
      organizationId,
      actorUserId: attribution.actorUserId,
      entityId,
      metadataJson,
      onBehalfOfUserId: attribution.onBehalfOfUserId,
    })
  }
}

function toSummary(user: User): CurrentUserSummary {
  return {
    userId: user.id,
    organizationId: user.organizationId,
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
