import { UnprocessableError } from '@collega/application/common'
import { describe, expect, it } from 'vitest'
import { renderProblem } from './problem-render.js'

describe('UnprocessableError', () => {
  it('renders 422 with the rule code as the message key', () => {
    const { status, body } = renderProblem(
      new UnprocessableError('taskBlocked', 'The task has open blockers.'),
    )

    expect(status).toBe(422)
    expect(body.title).toBe('Unprocessable Entity')
    expect(body.detail).toBe('taskBlocked')
  })
})
