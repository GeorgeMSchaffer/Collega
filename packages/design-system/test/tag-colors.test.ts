// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CHIP_THEMES,
  contrastRatio,
  mixSrgb,
  TAG_PALETTE,
  TEXT_CONTRAST_MIN,
  THEME_NAMES,
  tagChipColors,
} from '../src/lib/tag-colors.js'

// SPEC/20-feature-client-ui.md "Tag colours and the effort bar".

const CORNERS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#00FFFF',
  '#FF00FF',
] as const
const GREYS = ['#808080', '#777777'] as const
const LIGHT_THEMES = THEME_NAMES.filter((theme) => theme !== 'graphite')

describe('tagChipColors', () => {
  describe.each(THEME_NAMES)('in %s', (theme) => {
    it.each([...TAG_PALETTE, ...CORNERS, ...GREYS])(
      'gives %s text that clears 4.5:1 against its own ground',
      (color) => {
        const chip = tagChipColors(color, theme)
        expect(contrastRatio(chip.text, chip.ground)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN)
        expect(chip.ratio).toBeCloseTo(contrastRatio(chip.text, chip.ground), 10)
      },
    )
  })

  describe.each(LIGHT_THEMES)('in the light theme %s', (theme) => {
    it.each(TAG_PALETTE)('keeps %s at its 40% share, so the chip reads as its colour', (color) => {
      expect(tagChipColors(color, theme).textShare).toBe(40)
    })
  })

  it.each(TAG_PALETTE)('keeps %s at Graphite’s 62% share', (color) => {
    expect(tagChipColors(color, 'graphite').textShare).toBe(62)
  })

  it('mixes the ground 16% of the tag colour into the card, per channel in gamma-encoded sRGB', () => {
    // 0xE5*0.16 + 0xFF*0.84 = 250.84, 0x48*0.16 + 0xFF*0.84 = 225.72, 0x4D*0.16 + 0xFF*0.84 = 226.52
    expect(tagChipColors('#E5484D', 'terrazzo').ground).toBe('#FBE2E3')
  })

  it('makes the border the tag colour at 30% over transparent', () => {
    expect(tagChipColors('#5CC8E0', 'lagoon').border).toBe('rgb(92 200 224 / 30%)')
  })

  it('steps a failing share down by five points to the first one that clears 4.5:1', () => {
    // #FFFF00 in Terrazzo fails at its 40% start and first clears at 35%.
    const chip = tagChipColors('#FFFF00', 'terrazzo')
    expect(contrastRatio(mixSrgb('#FFFF00', '#1E2733', 40), chip.ground)).toBeLessThan(4.5)
    expect(chip.textShare).toBe(35)
    expect(chip.text).toBe(mixSrgb('#FFFF00', '#1E2733', 35))
  })

  it('accepts lower-case input and answers upper-case colours', () => {
    expect(tagChipColors('#e5484d', 'terrazzo')).toEqual(tagChipColors('#E5484D', 'terrazzo'))
  })

  it('refuses anything that is not #RRGGBB', () => {
    expect(() => tagChipColors('#FFF', 'terrazzo')).toThrow(RangeError)
    expect(() => tagChipColors('red', 'terrazzo')).toThrow(RangeError)
  })

  // The spec's measurement: a 16-step grid of every channel, in all five themes.
  it('stops at or above 4.5:1 within four steps over the 4,096-colour grid, and plain ink never fails', () => {
    const levels = Array.from({ length: 16 }, (_, i) => i * 17)
    const hex = (n: number) => n.toString(16).padStart(2, '0')
    for (const theme of THEME_NAMES) {
      const { ink, textShare: start } = CHIP_THEMES[theme]
      for (const r of levels)
        for (const g of levels)
          for (const b of levels) {
            const color = `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
            const chip = tagChipColors(color, theme)
            expect(chip.ratio, `${color} in ${theme}`).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN)
            expect(start - chip.textShare, `${color} in ${theme}`).toBeLessThanOrEqual(4 * 5)
            expect(
              contrastRatio(ink, chip.ground),
              `ink on ${color} in ${theme}`,
            ).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN)
          }
    }
  })
})

describe('mixSrgb', () => {
  it('mixes per channel in gamma-encoded sRGB, as color-mix(in srgb) does', () => {
    // A linear-light mix of black and white at 50% would give #BCBCBC; sRGB gives the midpoint.
    expect(mixSrgb('#000000', '#FFFFFF', 50)).toBe('#808080')
    expect(mixSrgb('#FF0000', '#0000FF', 25)).toBe('#4000BF')
  })
})

/**
 * `CHIP_THEMES` is a copy of values that live in `globals.css` (`THEME_NAMES` is checked against the
 * web app's picker in `apps/web/test/theme-names.test.ts`); the contrast guarantee
 * above only holds while they match their sources.
 */
describe('the chip themes match their sources', () => {
  const css = readFileSync(new URL('../src/globals.css', import.meta.url), 'utf8')

  function token(theme: string, name: string): string | undefined {
    const block = new RegExp(`:root\\[data-theme="${theme}"\\][^{]*\\{([^}]*)\\}`).exec(css)?.[1]
    return block
      ? new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block)?.[1]?.toUpperCase()
      : undefined
  }

  it.each(THEME_NAMES)('%s has the card and ink of its globals.css block', (theme) => {
    expect(token(theme, 'card')).toBe(CHIP_THEMES[theme].card)
    expect(token(theme, 'foreground')).toBe(CHIP_THEMES[theme].ink)
  })

  it('the bare :root is Terrazzo, which is the chip’s base colour set', () => {
    expect(css).toMatch(/:root,\s*:root\[data-theme="terrazzo"\]\s*\{/)
  })
})
