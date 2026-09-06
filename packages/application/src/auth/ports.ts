import type { User } from '@collega/domain/users'
import type { AuthenticatedPrincipal } from './models.js'

export interface PasswordHasher {
  hash(password: string): string
  verify(password: string, passwordHash: string): boolean
}

export type AccessTokenResult = {
  readonly token: string
  readonly expiresInSeconds: number
}

/**
 * Signed-JWT access token issuance/validation ports (SPEC/30-Contracts.md "Access Token Format
 * and Session Revocation", SPEC/20-feature-auth.md #35-36). The JWT embeds the issuing
 * `User.securityStamp` as a claim; validation only checks the signature and expiry here - the
 * caller (`TokenAuthenticationService`) is responsible for revalidating the returned
 * `securityStamp` against the user's current database value.
 */
export interface AccessTokenIssuer {
  issue(userId: string, securityStamp: string, nowUtc: Date): AccessTokenResult
}

export type ValidatedAccessToken = {
  readonly userId: string
  readonly securityStamp: string
}

export interface AccessTokenValidator {
  /** Returns `null` when the token is malformed, unsigned, or expired. */
  tryValidate(token: string, nowUtc: Date): ValidatedAccessToken | null
}

/**
 * Decodes and re-encodes user-supplied image uploads. The contract is deliberately
 * content-first: the implementation must decode the raw bytes through a real image codec and
 * reject anything that isn't a genuine raster image, rather than trusting a file extension or
 * declared MIME type. This is the security boundary for the profile-portrait feature - a
 * text/exe payload renamed to `.png` must come back as `null`.
 */
export interface ImageProcessor {
  /**
   * Validates `input` as a supported raster image (GIF, JPEG, or PNG), then produces a
   * square-fitting PNG thumbnail no larger than `maxDimension` pixels on either side (aspect
   * ratio preserved; never upscaled). Returns `null` when the input is empty, not a decodable
   * image, or not one of the supported formats.
   */
  /**
   * Asynchronous, unlike the .NET `IImageProcessor` it ports. That is forced rather than
   * chosen: ImageSharp offered a synchronous API and `sharp` does not, so a synchronous
   * signature here cannot be implemented at all. The result is unchanged.
   */
  tryCreatePngThumbnail(input: Uint8Array, maxDimension: number): Promise<Uint8Array | null>
}

/**
 * Resolves an active View As session for the real user behind a validated token, if any.
 *
 * This is the extension point that keeps View As/impersonation isolated in its own slice
 * (SPEC/50-typescript-migration.md Wave B7, `SPEC/20-feature-view-as.md` rule 3): the C# original
 * (`TokenAuthenticationService`) reaches directly into `IImpersonationSessionRepository` and the
 * `ImpersonationSession` domain entity, both of which belong to the isolated View As slice, not
 * this one. Returning `null` means "no session, authenticate as the real user" - see the slice
 * report for the reasoning.
 */
export interface ImpersonationResolver {
  resolveActingPrincipal(realUser: User, nowUtc: Date): Promise<AuthenticatedPrincipal | null>
}

// Clock, UnitOfWork, and AuditEventWriter/AuditEventInput come from the shared kernel
// (packages/application/src/common) - not redeclared here.
