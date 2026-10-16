// `verifyIdeasMoved`'s failed landing check, as `translateWriteError` meets it (contracts/boards.md
// `ideaMoves`; decided 2026-10-16): Postgres refuses `move-unavailable:<hex of the title>` with
// SQLSTATE 22P02, Prisma reports P2010, and the save becomes a 400 keyed `ideaMoves`. The pull
// marker's own translation is pinned in constraint-errors.test.ts; this proves the two stay
// distinct.

import { ValidationError } from '@collega/application/common'
import { describe, expect, it } from 'vitest'
import { Prisma } from '../src/generated/prisma/index.js'
import {
  MOVE_UNAVAILABLE_MARKER,
  PULL_UNAVAILABLE_MARKER,
  translateWriteError,
} from '../src/persistence/constraint-errors.js'

const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex')

function p2010(message: string, sqlstate = '22P02') {
  return new Prisma.PrismaClientKnownRequestError('Raw query failed', {
    code: 'P2010',
    clientVersion: '6.19.3',
    meta: { code: sqlstate, message },
  })
}

describe('translateWriteError for a lane move that did not land', () => {
  const castFailure = (title: string) =>
    p2010(`invalid input syntax for type integer: "${MOVE_UNAVAILABLE_MARKER}${hex(title)}"`)

  it('becomes an ideaMoves validation error naming the idea, with the contract text', () => {
    const result = translateWriteError(castFailure('Fix the printer'))

    expect(result).toBeInstanceOf(ValidationError)
    expect((result as ValidationError).message).toBe('One or more fields are invalid.')
    expect((result as ValidationError).failures).toEqual({
      ideaMoves: ["'Fix the printer' is no longer in that lane."],
    })
  })

  it('round-trips quotes, newlines and non-ASCII titles through the hex', () => {
    const title = 'He said "no"\nline two é中'

    const result = translateWriteError(castFailure(title)) as ValidationError

    expect(result.failures.ideaMoves).toEqual([`'${title}' is no longer in that lane.`])
  })

  it('does not mistake the pull marker for a move, nor the move marker for a pull', () => {
    const pull = translateWriteError(
      p2010(`${PULL_UNAVAILABLE_MARKER}${hex('A')}`),
    ) as ValidationError
    const move = translateWriteError(
      p2010(`${MOVE_UNAVAILABLE_MARKER}${hex('A')}`),
    ) as ValidationError

    expect(Object.keys(pull.failures)).toEqual(['pullItemIds'])
    expect(Object.keys(move.failures)).toEqual(['ideaMoves'])
  })

  it.each([
    ['another SQLSTATE', p2010(`${MOVE_UNAVAILABLE_MARKER}${hex('A')}`, '23505')],
    ['a P2010 with no marker', p2010('syntax error at or near "SELECT"')],
  ])('leaves %s untouched', (_label, error) => {
    expect(translateWriteError(error)).toBe(error)
  })
})
