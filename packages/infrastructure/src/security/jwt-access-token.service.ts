import type {
  AccessTokenIssuer,
  AccessTokenResult,
  AccessTokenValidator,
  ValidatedAccessToken,
} from '@collega/application/auth'
import jsonwebtoken from 'jsonwebtoken'

/**
 * Configuration for {@link JwtAccessTokenService}, supplied by apps/api's config layer - this
 * class never reads `process.env` itself (SPEC/30-Contracts.md "Access Token Format and Session
 * Revocation"). `signingKey` mirrors .NET's `AccessTokenOptions.SigningKey`: if no stable key is
 * configured, generating a random one per process start is acceptable for a single instance but
 * invalidates every outstanding token on restart/redeploy and is not shared across instances -
 * that tradeoff belongs to whoever constructs this, not to this class.
 */
export type JwtAccessTokenConfig = {
  readonly signingKey: string
  readonly lifetimeSeconds: number
}

type AccessTokenClaims = {
  readonly sub: string
  readonly sstamp: string
}

/**
 * HS256 JWT issuer/validator. Ports .NET's hand-built `JwtAccessTokenService`, swapping the BCL
 * for the `jsonwebtoken` package: the .NET original avoided a JWT library specifically to avoid a
 * new NuGet dependency, a constraint that doesn't carry over here, and `jsonwebtoken`'s
 * synchronous `sign`/`verify` is what lets this class satisfy the port's synchronous signature -
 * `jose`, the other allowed import (see `biome.json`'s `security/**` override), is WebCrypto-based
 * and only exposes an async API.
 *
 * The payload carries the user's `securityStamp` as a custom `sstamp` claim; this class only
 * checks the signature and expiry. Revalidating `sstamp` against the current database value is
 * the caller's job (`TokenAuthenticationService`).
 */
export class JwtAccessTokenService implements AccessTokenIssuer, AccessTokenValidator {
  constructor(private readonly config: JwtAccessTokenConfig) {}

  issue(userId: string, securityStamp: string, nowUtc: Date): AccessTokenResult {
    const issuedAtSeconds = Math.floor(nowUtc.getTime() / 1000)
    const expiresAtSeconds = issuedAtSeconds + this.config.lifetimeSeconds

    const claims: AccessTokenClaims & { iat: number; exp: number } = {
      sub: userId,
      sstamp: securityStamp,
      iat: issuedAtSeconds,
      exp: expiresAtSeconds,
    }

    // noTimestamp: the explicit iat above is the one that counts - jsonwebtoken would otherwise
    // overwrite it with the real wall clock, defeating the `nowUtc` parameter's testability.
    const token = jsonwebtoken.sign(claims, this.config.signingKey, {
      algorithm: 'HS256',
      noTimestamp: true,
    })

    return { token, expiresInSeconds: this.config.lifetimeSeconds }
  }

  tryValidate(token: string, nowUtc: Date): ValidatedAccessToken | null {
    try {
      const payload = jsonwebtoken.verify(token, this.config.signingKey, {
        algorithms: ['HS256'],
        // Same reasoning as `noTimestamp` above: expiry is evaluated against the supplied clock,
        // not the real one, so this class stays deterministically testable.
        clockTimestamp: Math.floor(nowUtc.getTime() / 1000),
      })

      if (typeof payload !== 'object' || payload === null) {
        return null
      }

      const sub = payload.sub
      if (typeof sub !== 'string' || sub.length === 0) {
        return null
      }

      const sstamp = payload.sstamp
      return { userId: sub, securityStamp: typeof sstamp === 'string' ? sstamp : '' }
    } catch {
      // Malformed, unsigned, or expired - jsonwebtoken throws for all three; the port collapses
      // them to the same `null` the caller treats as "not authenticated".
      return null
    }
  }
}
