import {
  AuthService,
  type CurrentUserSummary,
  type RegisterResult,
} from '@collega/application/auth'
import type { CurrentUserContext } from '@collega/application/common'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Put,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { AllowWhilePasswordChangeRequired } from '../auth/allow-while-password-change-required.decorator.js'
import { AuthGuard } from '../auth/auth.guard.js'
import { setSessionCookie } from '../auth/session-cookie.js'
import {
  RequestValidationError,
  requirePresent,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { PORT_TOKENS } from '../common/tokens.js'

/** `POST /auth/login` request body (`SPEC/30-Contracts.md`). */
type LoginBody = { email?: string; password?: string }

/** `POST /auth/change-password` request body. */
type ChangePasswordBody = { currentPassword?: string; newPassword?: string }

/** `PUT /auth/me` request body. */
type UpdateProfileBody = { firstName?: string; lastName?: string }

/** `PUT /auth/me/portrait` request body - Base64 of the raw image file, or a full data URL. */
type UpdatePortraitBody = { imageBase64?: string }

/** `POST /auth/register` request body. */
type RegisterBody = {
  inviteCode?: string
  firstName?: string
  lastName?: string
  email?: string
  password?: string
}

/**
 * Decodes a portrait upload, accepting either a bare Base64 string or a full
 * `data:image/png;base64,...` URL. Returns `null` for anything that does not decode to at least
 * one byte, which the caller renders as a field-level failure.
 *
 * `Buffer.from(s, 'base64')` never throws - it discards characters outside the alphabet and
 * returns whatever is left, so a truthy result proves nothing on its own. Re-encoding and
 * comparing against the input, ignoring padding, is what actually rejects a corrupt string. The
 * .NET handler got this from `Convert.FromBase64String` throwing; here it has to be checked.
 */
function decodeBase64Image(value: string | undefined): Buffer | null {
  if (value === undefined || value.trim() === '') {
    return null
  }

  const commaIndex = value.indexOf(',')
  const payload =
    value.toLowerCase().startsWith('data:') && commaIndex >= 0 ? value.slice(commaIndex + 1) : value

  const bytes = Buffer.from(payload, 'base64')
  if (bytes.length === 0) {
    return null
  }

  const canonical = payload.replace(/=+$/, '')
  return bytes.toString('base64').replace(/=+$/, '') === canonical ? bytes : null
}

/**
 * The login response, minus the token.
 *
 * The .NET API returned `accessToken` in this body and the corpus records it on one fixture.
 * Decision `08` moved the session into an httpOnly cookie, and returning the token as well would
 * hand it back to JavaScript and defeat the point - so the field is gone and
 * `SPEC/30-Contracts.md` now says so. Everything else is unchanged, including `expiresInSeconds`,
 * which the client still needs to know when its session lapses.
 */
type LoginResponse = {
  expiresInSeconds: number
  requiresPasswordChange: boolean
  user: CurrentUserSummary
}

@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly auth: AuthService,
    @Inject(PORT_TOKENS.CurrentUserContext) private readonly currentUser: CurrentUserContext,
  ) {}

  /**
   * Anonymous by design - no `AuthGuard`. `AuthService.login` is the whole policy: it denies
   * inactive accounts ahead of the password check, records the lockout counter, and returns the
   * same message for an unknown email as for a wrong password, so this handler must not add
   * branching of its own.
   *
   * `passthrough: true` keeps Nest's serialization while still allowing the cookie to be set -
   * without it, returning a value from a handler that injects `@Res()` silently sends nothing.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    // A missing field is a 400 with field-level errors, NOT a 401 - the corpus distinguishes
    // them, and collapsing the two would tell an attacker that a malformed probe and a wrong
    // password are the same thing. This is the model-binding validation .NET got from
    // `[Required]` on the request record; Nest has no equivalent without a validation pipe, so
    // the check is explicit and the messages match what the corpus recorded.
    requirePresent({ email: body.email, password: body.password })

    const result = await this.auth.login({
      email: body.email ?? '',
      password: body.password ?? '',
    })

    setSessionCookie(res, result.accessToken, result.expiresInSeconds)

    return {
      expiresInSeconds: result.expiresInSeconds,
      requiresPasswordChange: result.requiresPasswordChange,
      user: result.user,
    }
  }

  /**
   * Identity comes from `CurrentUserContext`, never from the request - that port is the single
   * chokepoint the Biome override and `tools/arch/identity-chokepoint.test.ts` both enforce, and
   * reading a credential here would silently opt this endpoint out of View As.
   *
   * `userId` is the ACTING user, so during a live View As session this returns the impersonated
   * user with `viewingAs` populated. That is the whole reason the client refreshes its principal
   * from here rather than trusting what login handed it (Sprint 6.5's finding).
   */
  @Get('me')
  @UseGuards(AuthGuard)
  @AllowWhilePasswordChangeRequired()
  async me(): Promise<CurrentUserSummary> {
    const userId = this.currentUser.userId
    if (userId === null) {
      // Unreachable behind AuthGuard; if it ever happens the guard has been removed, and a 401
      // is a far better failure than dereferencing null.
      throw new UnauthorizedException()
    }
    return this.auth.getCurrentUser(userId)
  }

  /**
   * Not allowlisted mid-rotation, deliberately: only `GET /auth/me` and `change-password` carry
   * that opt-in on the .NET controller, so editing a profile while a forced change is pending is
   * a 403 here as it was there.
   */
  @Put('me')
  @UseGuards(AuthGuard)
  async updateMe(@Body() body: UpdateProfileBody): Promise<CurrentUserSummary> {
    validateFields({
      firstName: { value: body.firstName, required: true, maxLength: 100 },
      lastName: { value: body.lastName, required: true, maxLength: 100 },
    })

    return this.auth.updateProfile({
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
    })
  }

  /**
   * The body carries the raw image file as Base64, and a full data URL is accepted as well -
   * clients built on `FileReader.readAsDataURL` send one without thinking about it, and the .NET
   * handler took both. What comes back is not what went in: the Application layer re-encodes
   * through the image processor, so the response's `portraitDataUrl` is the normalised PNG.
   */
  @Put('me/portrait')
  @UseGuards(AuthGuard)
  async updatePortrait(@Body() body: UpdatePortraitBody): Promise<CurrentUserSummary> {
    const imageBytes = decodeBase64Image(body.imageBase64)
    if (imageBytes === null) {
      // Not a `requirePresent` failure: a present-but-unreadable string is a different fault from
      // a missing one, and the .NET handler keyed both on `imageBase64` with this wording.
      throw new RequestValidationError({
        imageBase64: ['The uploaded image could not be read.'],
      })
    }

    return this.auth.updatePortrait(imageBytes)
  }

  /** Reverts to the initials avatar. Returns the whole summary, not 204, so the client can rerender. */
  @Delete('me/portrait')
  @UseGuards(AuthGuard)
  async removePortrait(): Promise<CurrentUserSummary> {
    return this.auth.removePortrait()
  }

  /**
   * Anonymous by design - the invite code is the credential. `AuthService.register` owns every
   * rejection past field presence: an unknown or expired code is a `400` keyed on `inviteCode`
   * and an email already in use is a `409`, both thrown from Application code and therefore
   * carrying a `traceId` rather than the model-binding shape this handler's own check produces.
   * The corpus records both, which is how the two envelopes stay distinguishable.
   */
  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterBody): Promise<RegisterResult> {
    validateFields({
      inviteCode: { value: body.inviteCode, required: true },
      firstName: { value: body.firstName, required: true, maxLength: 100 },
      lastName: { value: body.lastName, required: true, maxLength: 100 },
      email: { value: body.email, required: true, email: true },
      password: { value: body.password, required: true },
    })

    return this.auth.register({
      inviteCode: body.inviteCode ?? '',
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
      password: body.password ?? '',
    })
  }

  /**
   * Allowed while a password change is pending - it is the only way out of that state, which is
   * why it carries the same opt-in as `GET /auth/me` (auth requirement #31).
   */
  @Post('change-password')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @AllowWhilePasswordChangeRequired()
  async changePassword(@Body() body: ChangePasswordBody): Promise<void> {
    await this.auth.changePassword({
      currentPassword: body.currentPassword ?? '',
      newPassword: body.newPassword ?? '',
    })
  }
}
