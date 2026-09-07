import { SetMetadata } from '@nestjs/common'
import type { Role } from '@collega/domain/enums'

export const ROLES_KEY = 'collega:roles'

/**
 * Marks a handler as restricted to a set of roles - the Nest analogue of .NET's
 * `[Authorize(Roles = "SiteAdmin")]`. Pair with `@UseGuards(AuthGuard, RolesGuard)`, AuthGuard
 * first so identity is resolved before RolesGuard reads it.
 *
 * This is a COARSE first gate only, mirroring the .NET controllers that use it
 * (`AiAssistController`, `IdeaAssistController`): "Role checks live in the use-case, not in this
 * controller - authorization is a use-case concern. The `[Authorize]` attributes here are a
 * coarse first gate only." Fine-grained authorization (org scoping,
 * `ensureNotDirectSiteAdmin`, ownership) still belongs in Application, reading
 * `CurrentUserContext` - this decorator does not replace that, it only reproduces the
 * framework-level rejection the golden corpus records for a handful of Site-Admin-only routes.
 */
export const Roles = (...roles: readonly Role[]) => SetMetadata(ROLES_KEY, roles)
