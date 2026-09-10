import { type EnvFragment, optional } from '../fragment.js'

export type AuthConfig = {
  /**
   * HS256 signing key for the session cookie's JWT. `undefined` when unset, which means "generate
   * a random one for this process" - fine for a single local instance, and fine for nothing else.
   *
   * In production it is **required**, and the fragment refuses to boot without it. See below.
   */
  readonly tokenSigningKey: string | undefined
  readonly accessTokenLifetimeSeconds: number
}

const DEFAULT_LIFETIME_MINUTES = 480 // Mirrors .NET's AccessTokenOptions.Lifetime default (8h).

/**
 * ACCESS_TOKEN_SIGNING_KEY / ACCESS_TOKEN_LIFETIME_MINUTES.
 *
 * The signing key is optional locally and required in production, because on Vercel **every cold
 * start is a new process** (`SPEC/50-vercel-deployment.md`). A random per-process key there is not
 * a mild inconvenience: two warm instances sign with different keys, so a session issued by one is
 * rejected by the other and users are signed out at unpredictable moments as functions recycle -
 * a symptom nobody would trace back to a missing environment variable. Refusing to boot is the
 * cheaper failure, and it is the same choice `SiteAdminConfig` already makes for its two keys.
 */
export const authFragment: EnvFragment<AuthConfig> = {
  name: 'auth',
  read(env, problems) {
    const rawLifetime = env.ACCESS_TOKEN_LIFETIME_MINUTES?.trim()
    const lifetimeMinutes = rawLifetime ? Number(rawLifetime) : DEFAULT_LIFETIME_MINUTES
    if (!Number.isFinite(lifetimeMinutes) || lifetimeMinutes <= 0) {
      problems.push('ACCESS_TOKEN_LIFETIME_MINUTES must be a positive number of minutes.')
    }

    const tokenSigningKey = optional(env, 'ACCESS_TOKEN_SIGNING_KEY')
    if (tokenSigningKey === undefined && env.NODE_ENV === 'production') {
      problems.push(
        'ACCESS_TOKEN_SIGNING_KEY is missing or empty. It is required when NODE_ENV=production: ' +
          'without it each process signs sessions with a key of its own, and on serverless that ' +
          'signs every user out whenever a cold start serves them.',
      )
    }

    return {
      tokenSigningKey,
      accessTokenLifetimeSeconds: Math.max(1, lifetimeMinutes) * 60,
    }
  },
}
