import type { Role } from '@collega/domain/enums'
import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'collega:roles'

/**
 * Marks a handler as restricted to a set of roles - the Nest analogue of the pre-migration API's
 * role-restricted authorization attribute. Pair with `@UseGuards(AuthGuard, RolesGuard)`, AuthGuard
 * first so identity is resolved before RolesGuard reads it.
 *
 * This is a COARSE first gate only, mirroring the pre-migration controllers that use it
 * (`AiAssistController`, `IdeaAssistController`): role checks live in the use-case, not in the
 * controller, because authorization is a use-case concern. Fine-grained authorization (org scoping,
 * `ensureNotDirectSiteAdmin`, ownership) still belongs in Application, reading
 * `CurrentUserContext` - this decorator does not replace that, it only reproduces the
 * framework-level rejection the golden corpus records for a handful of Site-Admin-only routes.
 */
export const Roles = (...roles: readonly Role[]) => SetMetadata(ROLES_KEY, roles)
