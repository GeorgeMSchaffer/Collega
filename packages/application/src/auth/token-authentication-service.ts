import { UserStatus } from '@collega/domain/enums'
import type { User } from '@collega/domain/users'
import type { UserRepository } from '../users/ports.js'
import type { AuthenticatedPrincipal } from './models.js'
import type { AccessTokenValidator, Clock, ImpersonationResolver } from './ports.js'

/**
 * Validates a bearer token and resolves the live `AuthenticatedPrincipal` behind it. Used
 * exclusively by the API's authentication handler to build the request's identity -
 * deliberately independent of `CurrentUserContext`, which doesn't exist yet at that point in the
 * pipeline.
 */
export class TokenAuthenticationService {
  constructor(
    private readonly tokenValidator: AccessTokenValidator,
    private readonly users: UserRepository,
    private readonly impersonation: ImpersonationResolver,
    private readonly clock: Clock,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedPrincipal | null> {
    if (!token) {
      return null
    }

    const validated = this.tokenValidator.tryValidate(token, this.clock.utcNow)
    if (!validated) {
      return null
    }

    const user = await this.users.getById(validated.userId)

    // Re-checked against live state on every request (not cached in the token) so a
    // deactivation mid-session takes effect immediately (auth requirement #15 for tokens too,
    // not just fresh logins).
    if (!user || user.status !== UserStatus.Active) {
      return null
    }

    // SPEC/20-feature-auth.md #35-36: a token whose embedded securityStamp no longer matches the
    // user's current value was issued before the most recent password change/administrative
    // reset and is treated as invalid, exactly like an expired token.
    if (user.securityStamp !== validated.securityStamp) {
      return null
    }

    // The token always names the real user; impersonation is never carried in it
    // (SPEC/20-feature-view-as.md rule 1). Resolving the session here - the one place identity is
    // already established - is what lets every downstream authorization check work unchanged.
    const impersonated = await this.impersonation.resolveActingPrincipal(user, this.clock.utcNow)
    if (impersonated) {
      return impersonated
    }

    return toPrincipal(user)
  }
}

function toPrincipal(user: User): AuthenticatedPrincipal {
  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    impersonation: null,
  }
}
