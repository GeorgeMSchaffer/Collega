// `POST /organizations/{organizationId}/issues` at the HTTP boundary (SPEC/contracts/delivery.md).
// The controller is driven directly with a stand-in IdeaService that, like the real one, runs the
// body-reading callback it is handed; failures are rendered through ProblemDetailsFilter so the
// status and error keys are what a client sees. Route wiring comes from Nest's decorator metadata.

import { ForbiddenError, NotFoundError, ValidationError } from '@collega/application/common'
import type { AddIssueCommand, IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const ORG = '11111111-1111-1111-1111-111111111111'
const SPRINT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STATUS = 'c0000000-0000-0000-0000-000000000001'
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const URL = `/api/v1/organizations/${ORG}/issues`

const VALID = {
  title: 'Shorter onboarding',
  problem: 'New starters wait a week for accounts.',
  proposedSolutions: ['Provision accounts before day one.'],
  impactRationale: 'Saves a week of productivity per hire.',
  priority: 'Medium',
  effort: 'Medium',
}

type Seen = { organizationId: string; command: AddIssueCommand | null }

/** A service whose `addIssue` reads the body as the real one does, then answers `outcome`. */
function controllerOver(
  outcome: 'accept' | Error,
  readsBody = true,
): { controller: IdeasController; seen: Seen[] } {
  const seen: Seen[] = []
  const ideas = {
    addIssue: async (organizationId: string, readCommand: () => AddIssueCommand) => {
      if (outcome instanceof Error && !readsBody) {
        seen.push({ organizationId, command: null })
        throw outcome
      }
      const command = readCommand()
      seen.push({ organizationId, command })
      if (outcome instanceof Error) throw outcome
      return { ideaId: 'new-idea', boardId: null }
    },
  } as unknown as IdeaService
  return { controller: new IdeasController(ideas, {} as UpvoteService), seen }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('POST /organizations/:organizationId/issues routing', () => {
  const handler = IdeasController.prototype.addIssue

  it('is a POST at the contract path answering 201', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('organizations/:organizationId/issues')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(201)
  })

  it('validates the organization id as a UUID path parameter', () => {
    const params = Reflect.getMetadata('__routeArguments__', IdeasController, 'addIssue') as Record<
      string,
      { data?: string; pipes?: unknown[] }
    >
    const organizationParam = Object.values(params).find((p) => p.data === 'organizationId')
    expect(organizationParam?.pipes).toContain(UuidParamPipe)
  })
})

describe('POST /organizations/:organizationId/issues body parsing', () => {
  it('returns the service result and hands over the organization, effort and sprint', async () => {
    const { controller, seen } = controllerOver('accept')

    const result = await controller.addIssue(ORG, { ...VALID, effort: 'High', sprintId: SPRINT })

    expect(result).toEqual({ ideaId: 'new-idea', boardId: null })
    expect(seen[0]?.organizationId).toBe(ORG)
    expect(seen[0]?.command).toMatchObject({
      title: VALID.title,
      priority: 'Medium',
      effort: 'High',
      sprintId: SPRINT,
    })
  })

  it.each([
    ['omitted', {}],
    ['null', { sprintId: null }],
    ['blank', { sprintId: '  ' }],
  ])('reads %s sprintId as no sprint (the backlog)', async (_label, extra) => {
    const { controller, seen } = controllerOver('accept')

    await controller.addIssue(ORG, { ...VALID, ...extra })

    expect(seen[0]?.command?.sprintId).toBeNull()
  })

  it('turns a malformed sprintId into the empty GUID, never the raw text', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.addIssue(ORG, { ...VALID, sprintId: 'not-a-guid' })

    expect(seen[0]?.command?.sprintId).toBe(EMPTY_GUID)
  })

  it.each([
    ['omitted', undefined],
    ['a number', 3],
  ])('passes %s effort on as empty so the service refuses it', async (_label, effort) => {
    const { controller, seen } = controllerOver('accept')

    await controller.addIssue(ORG, { ...VALID, effort })

    expect(seen[0]?.command?.effort).toBe('')
  })

  it('does not forward a statusId from the body', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.addIssue(ORG, { ...VALID, statusId: STATUS })

    expect(seen[0]?.command).not.toHaveProperty('statusId')
  })
})

describe('POST /organizations/:organizationId/issues refusals', () => {
  it('answers 400 keyed title when a pool-create field is missing', async () => {
    const { controller } = controllerOver('accept')
    const { title: _omitted, ...withoutTitle } = VALID

    const error = await thrownBy(controller.addIssue(ORG, withoutTitle))

    const rendered = renderProblem(error, URL)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['title'])
  })

  it('answers 400 keyed proposedSolutions when the list is missing', async () => {
    const { controller } = controllerOver('accept')
    const { proposedSolutions: _omitted, ...withoutSolutions } = VALID

    const rendered = renderProblem(await thrownBy(controller.addIssue(ORG, withoutSolutions)), URL)

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['proposedSolutions'])
  })

  it('renders a service effort refusal as 400 keyed effort', async () => {
    const refusal = new ValidationError('One or more fields are invalid.', {
      effort: ['Effort must be Low, Medium or High.'],
    })
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(await thrownBy(controller.addIssue(ORG, VALID)), URL)

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['effort'])
  })

  it('renders a service sprint refusal as 400 keyed sprintId', async () => {
    const refusal = new ValidationError('One or more fields are invalid.', {
      sprintId: ['A completed sprint cannot take new issues.'],
    })
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(
      await thrownBy(controller.addIssue(ORG, { ...VALID, sprintId: SPRINT })),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['sprintId'])
  })

  it.each([
    ['403', new ForbiddenError('You are not allowed to add an issue.'), 403],
    ['404', new NotFoundError('Organization not found.'), 404],
  ])('renders a service %s refusal with that status', async (_label, refusal, status) => {
    const { controller } = controllerOver(refusal, false)

    const rendered = renderProblem(await thrownBy(controller.addIssue(ORG, VALID)), URL)

    expect(rendered.status).toBe(status)
  })
})
