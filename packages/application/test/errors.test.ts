// Cheap but load-bearing: apps/api maps HTTP status codes off `kind`, so a wrong `kind` or a
// `name` that doesn't survive `instanceof` would misroute every error response silently.

import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../src/common/errors.js'

describe('the ApplicationError family', () => {
  it.each([
    [ForbiddenError, 'forbidden'],
    [UnauthorizedError, 'unauthorized'],
    [NotFoundError, 'notFound'],
    [ConflictError, 'conflict'],
    [ValidationError, 'validation'],
  ] as const)('%s carries kind %s and its own constructor name', (ErrorClass, kind) => {
    const error = new ErrorClass('boom')
    expect(error.kind).toBe(kind)
    expect(error.name).toBe(ErrorClass.name)
    expect(error.message).toBe('boom')
    expect(error).toBeInstanceOf(Error)
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
