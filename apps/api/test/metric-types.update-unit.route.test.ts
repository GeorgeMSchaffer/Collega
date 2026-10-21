// `PUT /organizations/{organizationId}/metric-types/{metricTypeId}` is a full replacement
// (SPEC/contracts/metric-types.md; decided 2026-10-16 "Board References follow-ups"): `unit` is
// required as text or an explicit null, and a body without one is `400` "Unit is required." keyed
// `unit`. The key-only checks are in metric-types.routes.test.ts; this pins the message, the
// accepted values and the combination with `isArchived`.

import type { IdeaMetricsService, MetricTypeService } from '@collega/application/metric-types'
import { describe, expect, it } from 'vitest'
import { MetricTypesController } from '../src/metric-types/metric-types.controller.js'
import { renderProblem } from './problem-render.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const MT = '22222222-2222-4222-8222-222222222221'
const URL = `/api/v1/organizations/${ORG}/metric-types/${MT}`

function controllerOver() {
  const updates: unknown[][] = []
  const controller = new MetricTypesController(
    {
      update: async (...args: unknown[]) => {
        updates.push(args)
        return {}
      },
    } as unknown as MetricTypeService,
    {} as IdeaMetricsService,
  )
  return { controller, updates }
}

async function rejected(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return renderProblem(error, URL)
}

describe('PUT metric type: unit is required', () => {
  it.each([
    ['absent', undefined],
    ['a number', 5],
    ['a boolean', false],
    ['an object', {}],
    ['an array', ['h']],
  ])(
    'answers 400 "Unit is required." keyed unit when unit is %s, without calling the service',
    async (_l, unit) => {
      const { controller, updates } = controllerOver()
      const body =
        unit === undefined
          ? { name: 'N', isArchived: false }
          : { name: 'N', unit, isArchived: false }

      const rendered = await rejected(controller.update(ORG, MT, body as never))

      expect(rendered.status).toBe(400)
      expect(rendered.body.errors).toEqual({ unit: ['Unit is required.'] })
      expect(updates).toEqual([])
    },
  )

  it.each([
    ['text', 'hours', 'hours'],
    ['a blank string (stored as null)', '', null],
    ['an explicit null', null, null],
  ])('accepts a unit that is %s and hands it on', async (_l, unit, expected) => {
    const { controller, updates } = controllerOver()

    await controller.update(ORG, MT, { name: 'N', unit, isArchived: false })

    expect(updates[0]?.[2]).toMatchObject({ unit: expected })
  })

  it('reports unit and isArchived together when both are wrong', async () => {
    const { controller, updates } = controllerOver()

    const rendered = await rejected(controller.update(ORG, MT, { name: 'N' } as never))

    expect(rendered.body.errors).toEqual({
      unit: ['Unit is required.'],
      isArchived: ['Is Archived is required.'],
    })
    expect(updates).toEqual([])
  })
})
