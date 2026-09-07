import { type EnvFragment, optional } from '../fragment.js'

export type AuthConfig = {
  /**
   * HS256 signing key for the session cookie's JWT. `undefined` when unset - mirrors .NET's
   * `Auth:TokenSigningKey`, where a missing key means "generate a random one for this process",
   * not "fail to boot". That is fine for a single local instance and wrong for more than one
   * (every other instance rejects the first one's tokens), which is a deployment's problem to
   * get right, not something this fragment can enforce from one process's environment.
   */
  readonly tokenSigningKey: string | undefined
  readonly accessTokenLifetimeSeconds: number
}

const DEFAULT_LIFETIME_MINUTES = 480 // Mirrors .NET's AccessTokenOptions.Lifetime default (8h).

/** ACCESS_TOKEN_SIGNING_KEY / ACCESS_TOKEN_LIFETIME_MINUTES. Never fails fast - see AuthConfig. */
export const authFragment: EnvFragment<AuthConfig> = {
  name: 'auth',
  read(env, problems) {
    const rawLifetime = env.ACCESS_TOKEN_LIFETIME_MINUTES?.trim()
    const lifetimeMinutes = rawLifetime ? Number(rawLifetime) : DEFAULT_LIFETIME_MINUTES
    if (!Number.isFinite(lifetimeMinutes) || lifetimeMinutes <= 0) {
      problems.push('ACCESS_TOKEN_LIFETIME_MINUTES must be a positive number of minutes.')
    }

    return {
      tokenSigningKey: optional(env, 'ACCESS_TOKEN_SIGNING_KEY'),
      accessTokenLifetimeSeconds: Math.max(1, lifetimeMinutes) * 60,
    }
  },
}
