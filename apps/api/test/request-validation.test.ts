// The camelCase-key / spaced-Title-Case-message split is a documented contract
// (`SPEC/30-Contracts.md` "Validation Message Conventions", resolved 2026-08-07) that has already
// been got wrong once - it shipped producing "FirstName is required." where the corpus records
// "First Name is required.". These tests pin the wording and, just as importantly, the
// ACCUMULATION behaviour: ASP.NET's ModelState collected every failure across every attribute, so
// a refactor to sequential early-return checks must break loudly here rather than quietly halve
// the errors an existing client renders.
//
// Every expected string is taken from `src/Collega.API/Validation/ValidationMessages.cs` or from a
// recorded fixture (`tools/golden/fixtures/auth.viewas.start.missing-target.json` for the
// "Target User Id" spelling); none is invented.

import { describe, expect, it } from 'vitest'
import {
  RequestValidationError,
  requirePresent,
  validateFields,
} from '../src/common/errors/request-validation.error.js'

/** Runs `fn`, and returns the `failures` of the RequestValidationError it threw. */
function failuresOf(fn: () => void): Record<string, readonly string[]> {
  try {
    fn()
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return error.failures as Record<string, readonly string[]>
    }
    throw error
  }
  throw new Error('expected a RequestValidationError, but nothing was thrown')
}

describe('displayName - camelCase key, spaced Title Case message', () => {
  it('keys the errors object by the camelCase field name, not by the spaced one', () => {
    const failures = failuresOf(() => requirePresent({ firstName: '' }))
    expect(Object.keys(failures)).toEqual(['firstName'])
    expect(failures.firstName).toEqual(['First Name is required.'])
  })

  it('splits targetUserId as "Target User Id", never "Target User I d"', () => {
    // Recorded verbatim in tools/golden/fixtures/auth.viewas.start.missing-target.json. The word
    // boundary is lowercase-or-digit followed by uppercase, so the "I" and "d" of "Id" stay
    // together; splitting on every capital would produce the wrong string here and nowhere else.
    const failures = failuresOf(() => requirePresent({ targetUserId: undefined }))
    expect(failures.targetUserId).toEqual(['Target User Id is required.'])
  })

  it('leaves a single-word field unchanged', () => {
    const failures = failuresOf(() => requirePresent({ email: '' }))
    expect(failures.email).toEqual(['Email is required.'])
  })

  it('does not split a digit away from the word it belongs to', () => {
    // imageBase64: the boundary is e->B only. A rule that split before digits would say
    // "Image Base 64", which no fixture records.
    const failures = failuresOf(() => requirePresent({ imageBase64: '' }))
    expect(failures.imageBase64).toEqual(['Image Base64 is required.'])
  })

  it('spaces every boundary in a three-word field and title-cases each part as written', () => {
    const failures = failuresOf(() =>
      requirePresent({ thumbnailDataUri: '', logoUrl: '', inviteCode: '' }),
    )
    expect(failures.thumbnailDataUri).toEqual(['Thumbnail Data Uri is required.'])
    expect(failures.logoUrl).toEqual(['Logo Url is required.'])
    expect(failures.inviteCode).toEqual(['Invite Code is required.'])
  })
})

describe('validateFields - accumulation', () => {
  it('reports BOTH the required and the email failure for one omitted field, under one key', () => {
    // This is the property the ModelState port was designed for: .NET evaluated every attribute
    // on a property independently, so an absent `email` failed [RequiredField] AND [EmailFormat]
    // and returned two messages. A rewrite to `if (missing) return` would drop the second.
    const failures = failuresOf(() =>
      validateFields({ email: { value: undefined, required: true, email: true } }),
    )
    expect(failures.email).toEqual(['Email is required.', 'Email must be a valid email address.'])
  })

  it('accumulates required, max length, and email failures on a single field at once', () => {
    const failures = failuresOf(() =>
      validateFields({ email: { value: '     ', required: true, maxLength: 3, email: true } }),
    )
    expect(failures.email).toEqual([
      'Email is required.',
      'Email must be 3 characters or fewer.',
      'Email must be a valid email address.',
    ])
  })

  it('does not stop at the first failing field', () => {
    const failures = failuresOf(() =>
      validateFields({
        inviteCode: { value: '', required: true },
        firstName: { value: '', required: true, maxLength: 100 },
        lastName: { value: 'Ok', required: true, maxLength: 100 },
        email: { value: 'nope', required: true, email: true },
      }),
    )
    expect(Object.keys(failures).sort()).toEqual(['email', 'firstName', 'inviteCode'])
    expect(failures.email).toEqual(['Email must be a valid email address.'])
  })

  it('throws nothing when every field passes', () => {
    expect(() =>
      validateFields({
        firstName: { value: 'Ada', required: true, maxLength: 100 },
        email: { value: 'ada@example.test', required: true, email: true },
      }),
    ).not.toThrow()
  })

  it('carries the corpus envelope title as its message', () => {
    // problem-details.filter.ts renders `title` from this; the recorded 400s all read exactly so.
    const error = new RequestValidationError({ email: ['Email is required.'] })
    expect(error.message).toBe('One or more fields are invalid.')
  })
})

describe('validateFields - required', () => {
  it('treats a whitespace-only value as absent', () => {
    expect(() => requirePresent({ firstName: ' \t\n ' })).toThrow(RequestValidationError)
  })

  it('accepts a value that is only meaningful once trimmed', () => {
    expect(() => requirePresent({ firstName: '  Ada  ' })).not.toThrow()
  })

  it('reads a non-string value as absent rather than throwing a TypeError', () => {
    // Body types are compile-time only and there is no ValidationPipe, so {"email": 123} reaches
    // here as a number. Without the guard the first .trim() would 500 an anonymous endpoint.
    for (const value of [123, null, {}, [], true]) {
      const failures = failuresOf(() => requirePresent({ email: value }))
      expect(failures.email).toEqual(['Email is required.'])
    }
  })
})

describe('validateFields - max length', () => {
  it('measures untrimmed, as MaxLengthAttribute did', () => {
    // The domain's own check trims first and is therefore looser; the two are not interchangeable,
    // and the boundary is exactly where they disagree.
    expect(() => validateFields({ firstName: { value: '  abc  ', maxLength: 5 } })).toThrow(
      RequestValidationError,
    )
  })

  it('allows a value exactly at the limit and rejects one character more', () => {
    expect(() =>
      validateFields({ firstName: { value: 'a'.repeat(100), maxLength: 100 } }),
    ).not.toThrow()
    const failures = failuresOf(() =>
      validateFields({ firstName: { value: 'a'.repeat(101), maxLength: 100 } }),
    )
    expect(failures.firstName).toEqual(['First Name must be 100 characters or fewer.'])
  })

  it('does not fire on an absent value when the field is not required', () => {
    expect(() => validateFields({ firstName: { value: undefined, maxLength: 100 } })).not.toThrow()
  })
})

describe('validateFields - email format', () => {
  // EmailAddressAttribute.IsValid, reproduced exactly: one '@', neither first nor last character.
  // Deliberately not stricter - accepting less than the .NET API accepted is as much a divergence
  // as accepting more.
  const accepted = ['a@b', 'ada@example.test', 'a b@c d', 'a@b.', '.@b']
  const rejected = ['@b', 'a@', 'a@b@c', 'ab', '@', '']

  for (const value of accepted) {
    it(`accepts ${JSON.stringify(value)}`, () => {
      expect(() => validateFields({ email: { value, email: true } })).not.toThrow()
    })
  }

  for (const value of rejected) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      const failures = failuresOf(() => validateFields({ email: { value, email: true } }))
      expect(failures.email).toEqual(['Email must be a valid email address.'])
    })
  }
})
