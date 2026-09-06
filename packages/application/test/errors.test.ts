// Cheap but load-bearing: apps/api maps HTTP status codes off `kind`, so a wrong `kind` or a
// `name` that doesn't survive `instanceof` would misroute every error response silently.

import { describe, expect, it } from 'vitest'
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  LockedOutError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from '../src/common/errors.js'

describe('the ApplicationError family', () => {
  it.each([
    [ForbiddenError, 'forbidden'],
    [UnauthorizedError, 'unauthorized'],
    [NotFoundError, 'notFound'],
    [ConflictError, 'conflict'],
    [LockedOutError, 'lockedOut'],
    [ValidationError, 'validation'],
  ] as const)('%s carries kind %s and its own constructor name', (ErrorClass, kind) => {
    const error = new ErrorClass('boom')
    expect(error.kind).toBe(kind)
    // `name` comes from `new.target.name` in the ApplicationError base constructor, not a
    // literal set on each subclass - subtle enough (and stack-trace/serialization visible
    // enough) to pin directly rather than trust transitively via the instanceof check below.
    expect(error.name).toBe(ErrorClass.name)
    expect(error.message).toBe('boom')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApplicationError)
  })

  it('RateLimitedError carries kind rateLimited, its own name, and retryAfterSeconds', () => {
    // RateLimitedError takes a second constructor argument, so it can't share the
    // it.each table above without every other row growing an unused parameter.
    const error = new RateLimitedError('slow down', 30)

    expect(error.kind).toBe('rateLimited')
    expect(error.name).toBe('RateLimitedError')
    expect(error.message).toBe('slow down')
    expect(error.retryAfterSeconds).toBe(30)
    expect(error).toBeInstanceOf(ApplicationError)
  })

  it('ValidationError defaults failures to an empty object when none are given', () => {
    const error = new ValidationError('invalid')
    expect(error.failures).toEqual({})
  })

  it('ValidationError keeps the field -> messages map it was given', () => {
    const error = new ValidationError('invalid', { email: ['is required', 'must be an email'] })
    expect(error.failures).toEqual({ email: ['is required', 'must be an email'] })
  })
})
