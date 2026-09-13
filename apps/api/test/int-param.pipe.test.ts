// Same reasoning as uuid-param.pipe.test.ts: the STATUS is the point. `{version:int}` was a route-
// matching constraint on the .NET side, so a segment it could not bind matched no endpoint at all.
// Nest's ParseIntPipe throws 400, which would be a visible divergence on the one route that has an
// integer parameter - so this asserts the exception type rather than merely that something threw.

import { BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { IntParamPipe } from '../src/common/int-param.pipe.js'

const pipe = new IntParamPipe()

describe('IntParamPipe', () => {
  it('parses a positive integer', () => {
    expect(pipe.transform('7')).toBe(7)
  })

  it('throws NotFoundException, not BadRequestException', () => {
    expect(() => pipe.transform('abc')).toThrow(NotFoundException)
    try {
      pipe.transform('abc')
    } catch (error) {
      expect(error).not.toBeInstanceOf(BadRequestException)
    }
  })

  it('rejects a decimal, an empty segment, and anything with trailing content', () => {
    expect(() => pipe.transform('1.5')).toThrow(NotFoundException)
    expect(() => pipe.transform('')).toThrow(NotFoundException)
    expect(() => pipe.transform('7x')).toThrow(NotFoundException)
    expect(() => pipe.transform(' 7')).toThrow(NotFoundException)
  })

  it('rejects a value no Int column could hold, which would otherwise be a 500', () => {
    expect(() => pipe.transform('99999999999')).toThrow(NotFoundException)
  })
})
