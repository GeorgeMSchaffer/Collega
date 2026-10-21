// QA for metric types (SPEC/contracts/metric-types.md, "Item fields" and "Numbers"): the name and
// unit limits, trimming, the blank unit, and the stored range and precision of a value.

import { describe, expect, it } from 'vitest'
import {
  checkMetricNumber,
  createMetricType,
  type MetricType,
  MetricTypeInvariantError,
  updateMetricType,
} from '../../src/metric-types/index.js'

const NOW = new Date('2026-10-16T09:00:00.000Z')
const LATER = new Date('2026-10-17T09:00:00.000Z')

function create(fields: { name: string; unit: string | null }): MetricType {
  return createMetricType({
    id: 'mt-1',
    organizationId: 'org-1',
    ...fields,
    nowUtc: NOW,
    actorUserId: 'admin-1',
  })
}

function refusal(run: () => unknown): { field: string; message: string } {
  try {
    run()
  } catch (error) {
    if (error instanceof MetricTypeInvariantError) {
      return { field: error.field, message: error.message }
    }
    throw error
  }
  throw new Error('expected the call to be refused')
}

describe('createMetricType', () => {
  it('creates an active type with the given fields and the creation stamps', () => {
    const type = create({ name: 'Annual savings', unit: '$' })

    expect(type).toMatchObject({
      id: 'mt-1',
      organizationId: 'org-1',
      name: 'Annual savings',
      unit: '$',
      isArchived: false,
      createdAtUtc: NOW,
      updatedAtUtc: NOW,
    })
  })

  it('trims the name', () => {
    expect(create({ name: '  Hours saved \t', unit: null }).name).toBe('Hours saved')
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   \t '],
  ])('refuses a name that is %s, keyed name', (_label, name) => {
    expect(refusal(() => create({ name, unit: null }))).toEqual({
      field: 'name',
      message: 'Name is required.',
    })
  })

  it('accepts a name of exactly 80 characters and refuses 81', () => {
    expect(create({ name: 'n'.repeat(80), unit: null }).name).toHaveLength(80)
    expect(refusal(() => create({ name: 'n'.repeat(81), unit: null }))).toEqual({
      field: 'name',
      message: 'Name must be 80 characters or fewer.',
    })
  })

  it('measures the name after trimming, so padding does not count against the limit', () => {
    expect(create({ name: ` ${'n'.repeat(80)} `, unit: null }).name).toHaveLength(80)
  })

  it('accepts a unit of exactly 20 characters and refuses 21, keyed unit', () => {
    expect(create({ name: 'x', unit: 'u'.repeat(20) }).unit).toHaveLength(20)
    expect(refusal(() => create({ name: 'x', unit: 'u'.repeat(21) }))).toEqual({
      field: 'unit',
      message: 'Unit must be 20 characters or fewer.',
    })
  })

  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('stores a %s unit as null', (_label, unit) => {
    expect(create({ name: 'x', unit }).unit).toBeNull()
  })

  it('trims a unit', () => {
    expect(create({ name: 'x', unit: ' hours ' }).unit).toBe('hours')
  })

  it('allows names to repeat: nothing in the domain looks at other types', () => {
    expect(create({ name: 'Savings', unit: '$' }).name).toBe(
      create({ name: 'Savings', unit: 'EUR' }).name,
    )
  })
})

describe('updateMetricType', () => {
  const existing = create({ name: 'Old', unit: '$' })

  it('replaces name, unit and archive state, and stamps the update', () => {
    const next = updateMetricType(
      existing,
      { name: ' New ', unit: ' ', isArchived: true },
      LATER,
      'admin-2',
    )

    expect(next).toMatchObject({
      id: 'mt-1',
      organizationId: 'org-1',
      name: 'New',
      unit: null,
      isArchived: true,
      createdAtUtc: NOW,
      updatedAtUtc: LATER,
    })
  })

  it('applies the same name and unit rules as create', () => {
    expect(
      refusal(() =>
        updateMetricType(existing, { name: '', unit: null, isArchived: false }, LATER, null),
      ).field,
    ).toBe('name')
    expect(
      refusal(() =>
        updateMetricType(
          existing,
          { name: 'x', unit: 'u'.repeat(21), isArchived: false },
          LATER,
          null,
        ),
      ).field,
    ).toBe('unit')
  })

  it('does not mutate the value it was given', () => {
    updateMetricType(existing, { name: 'New', unit: null, isArchived: true }, LATER, null)

    expect(existing).toMatchObject({ name: 'Old', unit: '$', isArchived: false })
  })
})

describe('checkMetricNumber', () => {
  const RANGE = 'must be between -999999999999999.99 and 999999999999999.99.'

  it.each([
    0, 1, -1, 0.1, 0.25, 1.5, 100.05, -3.25, 0.01, 123456.78, 999999999999999, -999999999999999,
  ])('accepts %s', (value) => {
    expect(() => checkMetricNumber('Projected', value)).not.toThrow()
    expect(() => checkMetricNumber('Realized', value)).not.toThrow()
  })

  it.each([
    1e15,
    -1e15,
    1e16,
    1e21,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN,
  ])('refuses %s as out of range, keyed metrics', (value) => {
    expect(refusal(() => checkMetricNumber('Projected', value))).toEqual({
      field: 'metrics',
      message: `Projected ${RANGE}`,
    })
  })

  it('names Realized in the message when Realized is the one checked', () => {
    expect(refusal(() => checkMetricNumber('Realized', 1e15)).message).toBe(`Realized ${RANGE}`)
    expect(refusal(() => checkMetricNumber('Realized', 0.001)).message).toBe(
      'Realized must have at most 2 decimal places.',
    )
  })

  it('treats 999999999999999.99 as 10^15 because a double cannot hold it, and refuses it', () => {
    expect(
      refusal(() => checkMetricNumber('Projected', Number('999999999999999.99'))).message,
    ).toBe(`Projected ${RANGE}`)
  })

  it.each([0.001, 1.005, 0.125, 2.999, 1e-7, 0.1 + 0.2])(
    'refuses %s for having more than two decimal places',
    (value) => {
      expect(refusal(() => checkMetricNumber('Projected', value))).toEqual({
        field: 'metrics',
        message: 'Projected must have at most 2 decimal places.',
      })
    },
  )

  it('refuses a negative number with too many decimals and accepts a negative with two', () => {
    expect(() => checkMetricNumber('Projected', -0.005)).toThrow(MetricTypeInvariantError)
    expect(() => checkMetricNumber('Projected', -0.05)).not.toThrow()
  })
})
