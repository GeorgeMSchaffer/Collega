// The status code is the whole point of this pipe existing. On the .NET side `{id:guid}` was a
// route-MATCHING constraint, so a non-GUID segment matched no endpoint and fell through to the
// framework's 404 - it was never a validation failure. Nest's built-in ParseUUIDPipe throws 400,
// which would be a visible contract divergence on every id route in the API, so this asserts the
// exception type rather than merely that something was thrown.

import { BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'

const pipe = new UuidParamPipe()

describe('UuidParamPipe', () => {
  it('passes a canonical 8-4-4-4-12 id through unchanged', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e'
    expect(pipe.transform(id)).toBe(id)
  })

  it('accepts uppercase hex - Guid.TryParse was case-insensitive', () => {
    const id = '0F8FAD5B-D9CB-469F-A165-70867728950E'
    expect(pipe.transform(id)).toBe(id)
  })

  it('throws NotFoundException, not BadRequestException', () => {
    expect(() => pipe.transform('not-a-guid')).toThrow(NotFoundException)
    try {
      pipe.transform('not-a-guid')
    } catch (error) {
      expect(error).not.toBeInstanceOf(BadRequestException)
    }
  })

  it('rejects the N, B and P Guid formats, which Prisma cannot accept', () => {
    // Guid.TryParse took all three; letting one through would only move the P2023 500 downstream,
    // so rejecting them is deliberate and this pins it as such rather than as an oversight.
    expect(() => pipe.transform('0f8fad5bd9cb469fa16570867728950e')).toThrow(NotFoundException)
    expect(() => pipe.transform('{0f8fad5b-d9cb-469f-a165-70867728950e}')).toThrow(
      NotFoundException,
    )
    expect(() => pipe.transform('(0f8fad5b-d9cb-469f-a165-70867728950e)')).toThrow(
      NotFoundException,
    )
  })

  it('rejects an empty segment, a mis-grouped id, and one with trailing content', () => {
    expect(() => pipe.transform('')).toThrow(NotFoundException)
    expect(() => pipe.transform('0f8fad5b-d9cb-469f-a16570867728950e')).toThrow(NotFoundException)
    expect(() => pipe.transform('0f8fad5b-d9cb-469f-a165-70867728950e ')).toThrow(NotFoundException)
    expect(() => pipe.transform('0f8fad5b-d9cb-469f-a165-70867728950eZ')).toThrow(NotFoundException)
  })

  it('does not care about the UUID version or variant nibbles', () => {
    // Nest's ParseUUIDPipe validates them; Guid.TryParse never did, and Postgres uuid accepts any
    // hex, so a stricter check here would 404 an id the .NET API served.
    const id = '00000000-0000-0000-0000-000000000000'
    expect(pipe.transform(id)).toBe(id)
  })
})
