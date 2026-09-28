// The structured idea fields and the list filters at the HTTP boundary (SPEC/30-Contracts.md Idea
// Contracts, 2026-09-27). The service is a stand-in that answers 403 whenever it is reached, which
// is what a non-author's empty `proposedSolutions` would get from the real one (it reads as a change
// to structured content). So "400 keyed proposedSolutions" here proves the controller refuses the
// missing list before authorization runs, not merely that some 400 exists.

import { ForbiddenError } from '@collega/application/common'
import type { IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { describe, expect, it } from 'vitest'
import { ProblemDetailsFilter } from '../src/common/errors/problem-details.filter.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'

const BOARD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const ORG = '11111111-1111-1111-1111-111111111111'
const IDEA = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const STATUS_A = 'c0000000-0000-0000-0000-000000000001'
const STATUS_B = 'c0000000-0000-0000-0000-000000000002'
const FIELD = 'f0000000-0000-0000-0000-000000000001'

type Call = { method: string; args: unknown[] }

function controller(): { controller: IdeasController; calls: Call[] } {
  const calls: Call[] = []
  const forbidden =
    (method: string) =>
    async (...args: unknown[]) => {
      calls.push({ method, args })
      throw new ForbiddenError('Only the author or an Org Admin can change this.')
    }
  const recorded =
    (method: string) =>
    async (...args: unknown[]) => {
      calls.push({ method, args })
      return {}
    }
  const ideas = {
    create: forbidden('create'),
    update: forbidden('update'),
    listByBoard: recorded('listByBoard'),
    listByOrganization: recorded('listByOrganization'),
  } as unknown as IdeaService
  return { controller: new IdeasController(ideas, {} as UpvoteService), calls }
}

/** A controller whose `update` succeeds, to read what the service was asked to do. */
function acceptingController(): { controller: IdeasController; calls: Call[] } {
  const calls: Call[] = []
  const ideas = {
    update: async (...args: unknown[]) => {
      calls.push({ method: 'update', args })
      return {}
    },
  } as unknown as IdeaService
  return { controller: new IdeasController(ideas, {} as UpvoteService), calls }
}

/** What `ProblemDetailsFilter` writes for `exception`, captured without an HTTP server. */
function render(
  exception: unknown,
  url: string,
): { status: number; body: Record<string, unknown> } {
  const captured = { status: 0, body: {} as Record<string, unknown> }
  const response = {
    status(code: number) {
      captured.status = code
      return this
    },
    setHeader() {
      return this
    },
    send(payload: string | Buffer) {
      captured.body = JSON.parse(payload.toString())
      return this
    },
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, originalUrl: url }),
    }),
  } as never
  new ProblemDetailsFilter().catch(exception, host)
  return captured
}

/** The command the service was first called with. */
function firstCommand<T>(calls: readonly Call[]): T {
  const call = calls[0]
  if (!call) throw new Error('the service was not called')
  return call.args[1] as T
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

const VALID = {
  title: 'Shorter onboarding',
  problem: 'New starters wait a week for accounts.',
  proposedSolutions: ['Provision accounts before day one.'],
  impactRationale: 'Saves a week of productivity per hire.',
  priority: 'Medium',
}

function withoutSolutions(): Record<string, unknown> {
  const { proposedSolutions: _omitted, ...rest } = VALID
  return rest
}

describe('proposedSolutions at the HTTP boundary', () => {
  it.each([
    ['missing', withoutSolutions()],
    ['null', { ...VALID, proposedSolutions: null }],
    ['an empty list', { ...VALID, proposedSolutions: [] }],
    ['a list of non-strings', { ...VALID, proposedSolutions: [1, 2] }],
  ])('answers create with 400 keyed proposedSolutions, not 403, when %s', async (_label, body) => {
    const { controller: ideas, calls } = controller()

    const error = await thrownBy(ideas.create(BOARD, body))

    const rendered = render(error, `/api/v1/boards/${BOARD}/ideas`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['proposedSolutions'])
    expect(calls).toHaveLength(0)
  })

  it.each([
    ['missing', withoutSolutions()],
    ['an empty list', { ...VALID, proposedSolutions: [] }],
  ])('answers PUT with 400 keyed proposedSolutions, not 403, when %s', async (_label, body) => {
    const { controller: ideas, calls } = controller()

    const error = await thrownBy(ideas.update(IDEA, body))

    const rendered = render(error, `/api/v1/ideas/${IDEA}`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['proposedSolutions'])
    expect(calls).toHaveLength(0)
  })

  it('reports a missing problem and impactRationale alongside proposedSolutions in one 400', async () => {
    const { controller: ideas } = controller()

    const error = await thrownBy(ideas.create(BOARD, { title: 'Only a title', priority: 'Low' }))

    const rendered = render(error, `/api/v1/boards/${BOARD}/ideas`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object).sort()).toEqual([
      'impactRationale',
      'problem',
      'proposedSolutions',
    ])
  })

  it('does not require a description any more', async () => {
    const { controller: ideas, calls } = controller()

    // The stand-in service answers 403, so reaching it at all is the pass condition here.
    const error = await thrownBy(ideas.create(BOARD, VALID))

    expect(render(error, `/api/v1/boards/${BOARD}/ideas`).status).toBe(403)
    expect(calls.map((call) => call.method)).toEqual(['create'])
  })

  it('reaches the service with the solutions as sent when they are present', async () => {
    const { controller: ideas, calls } = controller()

    await thrownBy(
      ideas.create(BOARD, { ...VALID, proposedSolutions: ['First', 'Second'], description: '  ' }),
    )

    const command = firstCommand<{ proposedSolutions: string[]; description: unknown }>(calls)
    expect(command.proposedSolutions).toEqual(['First', 'Second'])
    expect(command.description).toBeNull()
  })
})

describe('fieldValues on PUT', () => {
  it('passes null to the service when fieldValues is null, which leaves custom values untouched', async () => {
    const { controller: ideas, calls } = acceptingController()

    await ideas.update(IDEA, { ...VALID, fieldValues: null })

    expect(firstCommand<{ fieldValues: unknown }>(calls).fieldValues).toBeNull()
  })

  it('passes null to the service when fieldValues is absent', async () => {
    const { controller: ideas, calls } = acceptingController()

    await ideas.update(IDEA, VALID)

    expect(firstCommand<{ fieldValues: unknown }>(calls).fieldValues).toBeNull()
  })

  it('passes an empty list through as a replacement with nothing, not as "no change"', async () => {
    const { controller: ideas, calls } = acceptingController()

    await ideas.update(IDEA, { ...VALID, fieldValues: [] })

    expect(firstCommand<{ fieldValues: unknown }>(calls).fieldValues).toEqual([])
  })

  it('passes a supplied value through keyed by its field', async () => {
    const { controller: ideas, calls } = acceptingController()

    await ideas.update(IDEA, { ...VALID, fieldValues: [{ fieldDefinitionId: FIELD, value: 'x' }] })

    expect(firstCommand<{ fieldValues: unknown }>(calls).fieldValues).toEqual([
      { fieldDefinitionId: FIELD, value: 'x' },
    ])
  })
})

describe('repeatable list filters at the HTTP boundary', () => {
  it('reads a repeated key as every value and a single key as a one-item list (board list)', async () => {
    const { controller: ideas, calls } = controller()

    await ideas.listByBoard(BOARD, {
      statusId: [STATUS_A, STATUS_B],
      priority: 'High',
      tag: ['ux', '  ', 'Search'],
    })

    expect(firstCommand(calls)).toMatchObject({
      statusIds: [STATUS_A, STATUS_B],
      priorities: ['High'],
      tags: ['ux', 'Search'],
    })
  })

  it('reads absent filters as empty lists, which is no filter (organization list)', async () => {
    const { controller: ideas, calls } = controller()

    await ideas.listByOrganization(ORG, {})

    expect(firstCommand(calls)).toMatchObject({
      boardIds: [],
      statusIds: [],
      priorities: [],
      tags: [],
    })
  })

  it('turns a boardId that is not a GUID into the empty GUID, so it matches nothing', async () => {
    const { controller: ideas, calls } = controller()

    await ideas.listByOrganization(ORG, { boardId: [BOARD, "x' OR 1=1 --"] })

    expect(firstCommand<{ boardIds: string[] }>(calls).boardIds).toEqual([
      BOARD,
      '00000000-0000-0000-0000-000000000000',
    ])
  })
})
