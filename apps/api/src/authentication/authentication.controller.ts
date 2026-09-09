import { AuthService, type CurrentUserSummary } from '@collega/application/auth'
import type { CurrentUserContext } from '@collega/application/common'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { AllowWhilePasswordChangeRequired } from '../auth/allow-while-password-change-required.decorator.js'
import { AuthGuard } from '../auth/auth.guard.js'
import { setSessionCookie } from '../auth/session-cookie.js'
import { requirePresent } from '../common/errors/request-validation.error.js'
import { PORT_TOKENS } from '../common/tokens.js'

/** `POST /auth/login` request body (`SPEC/30-Contracts.md`). */
type LoginBody = { email?: string; password?: string }

/** `POST /auth/change-password` request body. */
type ChangePasswordBody = { currentPassword?: string; newPassword?: string }

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
