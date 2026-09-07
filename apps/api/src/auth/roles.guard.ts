import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { CurrentUserContext } from '@collega/application/common'
import type { Role } from '@collega/domain/enums'
import { PORT_TOKENS } from '../common/tokens.js'
import { ROLES_KEY } from './roles.decorator.js'

/**
 * Reads `CurrentUserContext.role` - never a raw credential, so this file does NOT join
 * `tools/arch/identity-chokepoint.test.ts`'s allowlist. Must run after `AuthGuard` in the
 * `@UseGuards(AuthGuard, RolesGuard)` list, since it depends on identity already being resolved
 * into the request-context store `AuthGuard` fills.
 *
 * Throws Nest's native `ForbiddenException`, not the kernel's `ForbiddenError` - this is a
 * framework-level rejection before any Application code runs, the same kind `AuthGuard`
 * produces for a missing/invalid credential (`problem-details.filter.ts`'s RFC-9110 branch).
 * Contrast `AuthGuard`'s mandatory-password-change check, which throws the KERNEL's
 * `ForbiddenError` because .NET's own equivalent (`PasswordChangeRequiredFilter`) throws
 * `ForbiddenAppException` - two different 403 shapes for two different reasons, not a
 * inconsistency.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PORT_TOKENS.CurrentUserContext) private readonly currentUser: CurrentUserContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required || required.length === 0) {
      return true
    }

    if (this.currentUser.role !== null && required.includes(this.currentUser.role)) {
      return true
    }

    throw new ForbiddenException()
  }
}
