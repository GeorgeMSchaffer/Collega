// Tag colour and name rules (SPEC/20-feature-ideas-and-engagement.md Tags rules 3, 6, 9, 14): any
// six-digit `#RRGGBB` is accepted and stored upper case, the palette is rule 9's ten in rule 9's
// order (the backfill and the seed index it), and a rename keeps the colour unless one is given.

import { describe, expect, it } from 'vitest'
import {
  createTag,
  NAME_MAX_LENGTH,
  normalizeTagColor,
  paletteColorAt,
  TAG_COLOR_PALETTE,
  TagDomainError,
  updateTag,
  validateTagName,
} from '../../src/tags/index.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')
const LATER = new Date('2026-09-29T12:00:00.000Z')

function fieldOf(action: () => unknown): string {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(TagDomainError)
    return (error as TagDomainError).field
  }
  throw new Error('expected a TagDomainError')
}

describe('TAG_COLOR_PALETTE', () => {
  it('is rule 9 in its listed order', () => {
    expect(TAG_COLOR_PALETTE).toEqual([
      '#E5484D',
      '#F5A524',
      '#3FB86B',
      '#2F9E8F',
      '#5CC8E0',
      '#6B9BF2',
      '#B08CF5',
      '#E879A6',
      '#A87B2F',
      '#94A3B8',
    ])
  })

  it('answers each index and refuses one outside it', () => {
    expect(paletteColorAt(0)).toBe('#E5484D')
    expect(paletteColorAt(9)).toBe('#94A3B8')
    expect(() => paletteColorAt(10)).toThrow(RangeError)
    expect(() => paletteColorAt(-1)).toThrow(RangeError)
  })
})

describe('normalizeTagColor', () => {
  it.each([
    ['#e5484d', '#E5484D'],
    ['#AbCdEf', '#ABCDEF'],
    ['#000000', '#000000'],
    ['#ffffff', '#FFFFFF'],
    ['#123456', '#123456'],
  ])('accepts %s and stores %s', (input, stored) => {
    expect(normalizeTagColor(input)).toBe(stored)
  })

  it.each([
    '',
    'E5484D',
    '#E5484',
    '#E5484D0',
    '#E5484DFF',
    '#FFF',
    '#GGGGGG',
    ' #E5484D',
    '#E5484D ',
    'red',
    'rgb(0,0,0)',
    '##E5484',
    '#E5484D\n',
  ])('refuses %j on color', (input) => {
    expect(fieldOf(() => normalizeTagColor(input))).toBe('color')
  })

  it('names the format in its message', () => {
    expect(() => normalizeTagColor('red')).toThrow('Color must be a valid #RRGGBB color.')
  })
})

describe('validateTagName', () => {
  it('trims', () => {
    expect(validateTagName('  Backend  ')).toBe('Backend')
  })

  it.each([null, undefined, '', '   '])('refuses %j as required, on name', (name) => {
    expect(fieldOf(() => validateTagName(name))).toBe('name')
    expect(() => validateTagName(name)).toThrow('Tag name is required.')
  })

  it('accepts exactly the limit after trimming and refuses one over', () => {
    expect(validateTagName(`  ${'a'.repeat(NAME_MAX_LENGTH)}  `)).toHaveLength(100)
    expect(fieldOf(() => validateTagName('a'.repeat(NAME_MAX_LENGTH + 1)))).toBe('name')
    expect(() => validateTagName('a'.repeat(101))).toThrow('Tag must be 100 characters or fewer.')
  })
})

describe('createTag and updateTag', () => {
  const tag = createTag({
    id: 'tag-1',
    organizationId: 'org-1',
    name: '  Backend ',
    color: '#2f9e8f',
    nowUtc: NOW,
    actorUserId: 'admin-1',
  })

  it('creates a trimmed, normalized tag with its colour upper case', () => {
    expect(tag).toMatchObject({
      name: 'Backend',
      normalizedName: 'backend',
      color: '#2F9E8F',
      createdAtUtc: NOW,
      createdByUserId: 'admin-1',
    })
  })

  it('refuses a blank organization and a bad colour on create', () => {
    const props = {
      id: 'tag-2',
      organizationId: 'org-1',
      name: 'x',
      color: '#000000',
      nowUtc: NOW,
      actorUserId: null,
    }
    expect(fieldOf(() => createTag({ ...props, organizationId: ' ' }))).toBe('organizationId')
    expect(fieldOf(() => createTag({ ...props, color: '#00000' }))).toBe('color')
  })

  it('keeps the stored colour when the change carries none', () => {
    const renamed = updateTag(tag, { name: 'BACKEND', color: null }, LATER, 'admin-2')
    expect(renamed).toMatchObject({
      id: 'tag-1',
      name: 'BACKEND',
      normalizedName: 'backend',
      color: '#2F9E8F',
      createdAtUtc: NOW,
      updatedAtUtc: LATER,
      updatedByUserId: 'admin-2',
    })
  })

  it('recolours upper case and refuses a bad colour', () => {
    expect(updateTag(tag, { name: 'Backend', color: '#abcdef' }, LATER, null).color).toBe('#ABCDEF')
    expect(fieldOf(() => updateTag(tag, { name: 'Backend', color: 'blue' }, LATER, null))).toBe(
      'color',
    )
  })
})
