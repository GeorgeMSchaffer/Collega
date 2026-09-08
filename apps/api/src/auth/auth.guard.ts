import type { AuthenticatedPrincipal, TokenAuthenticationService } from '@collega/application/auth'
import { ForbiddenError } from '@collega/application/common'
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { ResolvedIdentity } from '../common/request-context/request-context.js'
import { requestContextStorage } from '../common/request-context/request-context.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY } from './allow-while-password-change-required.decorator.js'
import { SESSION_COOKIE_NAME } from './session-cookie.js'

/**
 * This file and the request-context module are the ONLY places on the API side permitted to
 * read a credential. Everything else asks CurrentUserContext. That is what lets View As work
 * without any authorization code knowing impersonation exists - and reading a credential
 * anywhere else silently opts that code out of impersonation.
 *
 * A feature controller applies this the way .NET applies `[Authorize]`: `@UseGuards(AuthGuard)`
 * on the routes that need it. It is deliberately NOT a global `APP_GUARD` - `GET /api/v1/health`
 * (SPEC/30-Contracts.md) must answer even when the database is down, which means it must not
 * resolve identity at all, exactly like .NET's `HealthController` injects nothing.
 *
 * A missing or invalid cookie throws Nest's own `UnauthorizedException`, not the kernel's
 * `UnauthorizedError` - see `problem-details.filter.ts` for why that distinction is the whole
 * mechanism behind the corpus's two different 401 envelope shapes (a guard rejecting a request
 * before any Application code runs is the SAME kind of rejection ASP.NET's `[Authorize]`
 * produces; `UnauthorizedError` is reserved for a use case that authenticated fine and then
 * explicitly refused the request).
 *
 * Resolution is one call, not four: `TokenAuthenticationService.authenticate` (already ported,
 * B1) does the single `findAuthenticationSubject` query findings 07 section 5 calls for and the
 * five-check impersonation re-validation via `ImpersonationSessionResolver` (B7) - this guard
 * does none of that itself, it only reads the cookie and writes the result into the store the
 * middleware opened.
 *
 * The role written here is the TARGET's role during a live session. Nothing recomputes it at
 * read time, which is what makes `ensureNotDirectSiteAdmin` correct without a special case.
 *
 * Also enforces the mandatory first-login password change (SPEC/30-Contracts.md; auth
 * requirement #31), porting .NET's `PasswordChangeRequiredFilter`. That filter throws
 * `ForbiddenAppException` - the Application-layer kernel exception, NOT a framework rejection -
 * so this gate throws the kernel's `ForbiddenError` too, which `problem-details.filter.ts` maps
 * to the `collega.dev/problems/forbidden` shape. Deliberately NOT `ForbiddenException`: that
 * would produce the wrong one of the two 403 envelopes the golden corpus distinguishes. The
 * allowlist is opt-in via `@AllowWhilePasswordChangeRequired()`, mirroring .NET's attribute for
 * the same reason - a new endpoint is closed by default.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(PORT_TOKENS.TokenAuthenticationService)
    private readonly tokens: TokenAuthenticationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token: string | undefined = request.cookies?.[SESSION_COOKIE_NAME]

    if (!token) {
      throw new UnauthorizedException()
    }

    const principal = await this.tokens.authenticate(token)
    if (!principal) {
      throw new UnauthorizedException()
    }

    const store = requestContextStorage.getStore()
    if (!store) {
      // The middleware did not run. Failing here is right: an absent store must never be
      // read as "anonymous", or ensureNotDirectSiteAdmin passes for an unauthenticated call.
      throw new Error(
        'RequestContextMiddleware did not run for this route. Identity cannot be resolved.',
      )
    }

    if (principal.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
        ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY,
        [context.getHandler(), context.getClass()],
      )
      if (!allowed) {
        throw new ForbiddenError(
          'A password change is required before you can continue. Change your password and try again.',
        )
      }
    }

    store.identity = toResolvedIdentity(principal)
    return true
  }
}

function toResolvedIdentity(principal: AuthenticatedPrincipal): ResolvedIdentity {
  return {
    userId: principal.userId,
    organizationId: principal.organizationId,
    role: principal.role,
    isImpersonating: principal.impersonation !== null,
    realUserId: principal.impersonation?.realUserId ?? principal.userId,
  }
}
