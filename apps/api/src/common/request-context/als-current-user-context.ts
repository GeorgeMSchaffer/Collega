import type { CurrentUserContext } from '@collega/application/common'
import type { Role } from '@collega/domain/enums'
import { Injectable } from '@nestjs/common'
import {
  NoAmbientIdentityError,
  type RequestContext,
  requestContextStorage,
} from './request-context.js'

/**
 * Reads the ambient identity. Singleton with lazy getters, deliberately.
 *
 * Every property is a getter over the live store, so there is no field to go stale - which
 * is what makes a singleton safe here. A constructor doing `this.role = store.identity.role`
 * would serve the first request's role to every later request in that warm container,
 * forever. On Vercel that is the real hazard, since containers are reused across users, and
 * it is the serverless-shaped version of the Sprint 6.5 client bug where a stale principal
 * rendered administrator surfaces during a View As session.
 *
 * Never Scope.REQUEST.
 */
@Injectable()
export class AlsCurrentUserContext implements CurrentUserContext {
  private get store(): RequestContext {
    const store = requestContextStorage.getStore()
    if (!store) throw new NoAmbientIdentityError()
    return store
  }

  get isAuthenticated(): boolean {
    return this.store.identity !== null
  }

  get userId(): string | null {
    return this.store.identity?.userId ?? null
  }

  get organizationId(): string | null {
    return this.store.identity?.organizationId ?? null
  }

  get role(): Role | null {
    return this.store.identity?.role ?? null
  }

  get isImpersonating(): boolean {
    return this.store.identity?.isImpersonating ?? false
  }

  get realUserId(): string | null {
    return this.store.identity?.realUserId ?? null
  }
}
