// The error model. S0.3 owns it so that seven Wave B partitions do not each invent one.
//
// These carry no HTTP status. Mapping to a status code is apps/api's job - packages/
// application must stay usable without a web framework, and the layer lint enforces that.

/** Base for every error the application layer raises deliberately. */
export abstract class ApplicationError extends Error {
  abstract readonly kind: string

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** The caller is authenticated but not allowed to do this. Maps to 403. */
export class ForbiddenError extends ApplicationError {
  readonly kind = 'forbidden' as const
}

/** The caller is not authenticated, or the credential is no longer valid. Maps to 401. */
export class UnauthorizedError extends ApplicationError {
  readonly kind = 'unauthorized' as const
}

/** The thing addressed does not exist, or is not visible to this caller. Maps to 404. */
export class NotFoundError extends ApplicationError {
  readonly kind = 'notFound' as const
}

/** The request is well-formed but breaks a rule. Maps to 409. */
export class ConflictError extends ApplicationError {
  readonly kind = 'conflict' as const
}

/**
 * The account is locked after too many failed sign-in attempts. Maps to 429.
 *
 * Deliberately distinct from RateLimitedError even though both are 429: one is about an
 * account's own failed attempts and the other about a caller's request volume, and the .NET
 * side kept them apart. The golden corpus records whatever body each produced, so collapsing
 * them into one type would show up as a replay diff.
 */
export class LockedOutError extends ApplicationError {
  readonly kind = 'lockedOut' as const
}

/** The caller exceeded a rate limit. Maps to 429. See LockedOutError for why they differ. */
export class RateLimitedError extends ApplicationError {
  readonly kind = 'rateLimited' as const

  /**
   * How long until the window has room again, surfaced by the API as the `Retry-After`
   * header. A 429 that does not say when to come back leaves a well-behaved client guessing
   * and a badly-behaved one hammering.
   */
  readonly retryAfterSeconds: number

  constructor(message: string, retryAfterSeconds: number) {
    super(message)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Input failed validation. Maps to 400. */
export class ValidationError extends ApplicationError {
  readonly kind = 'validation' as const

  /** Field name -> the messages for it. Empty key means the error is about the whole request. */
  readonly failures: Readonly<Record<string, readonly string[]>>

  constructor(message: string, failures: Readonly<Record<string, readonly string[]>> = {}) {
    super(message)
    this.failures = failures
  }
}
