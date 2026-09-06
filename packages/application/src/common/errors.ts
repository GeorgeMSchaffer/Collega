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
