/**
 * Tag chip colours (`SPEC/20-feature-client-ui.md` "Tag colours and the effort bar").
 *
 * A tag stores one `#RRGGBB`; the chip mixes it with the theme so the same colour reads in every
 * theme. The text colour is computed rather than fixed, because a custom colour can be anything and
 * a fixed mix fails 4.5:1 for most of the palette. CSS `color-mix` cannot branch on contrast, so
 * this runs here and the server-rendered chip already carries its final colours.
 *
 * Every mix is per channel in gamma-encoded sRGB — what `color-mix(in srgb …)` computes — so these
 * values and a CSS fallback agree.
 */

/** Rule 9's palette (`20-feature-ideas-and-engagement.md`), in its listed order. */
export const TAG_PALETTE = [
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
] as const

export const THEME_NAMES = ['terrazzo', 'portico', 'sera', 'lagoon', 'graphite'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

/**
 * The two colours a chip is mixed with, per theme, and the share of tag colour the text starts at.
 * `card` and `ink` mirror `--card` and `--foreground` in `globals.css`; change them together.
 */
export const CHIP_THEMES: Readonly<
  Record<ThemeName, { card: string; ink: string; textShare: number }>
> = {
  terrazzo: { card: '#FFFFFF', ink: '#1E2733', textShare: 40 },
  portico: { card: '#FFFFFF', ink: '#16292E', textShare: 40 },
  sera: { card: '#FFFFFF', ink: '#1C2236', textShare: 40 },
  lagoon: { card: '#FFFFFF', ink: '#13302B', textShare: 40 },
  graphite: { card: '#16191C', ink: '#E6E8EA', textShare: 62 },
}

export const TEXT_CONTRAST_MIN = 4.5
const GROUND_SHARE = 16
const BORDER_ALPHA = 30
const STEP = 5

type Rgb = readonly [number, number, number]

const HEX = /^#[0-9a-f]{6}$/i

export function isHexColor(value: string): boolean {
  return HEX.test(value)
}

function parse(hex: string): Rgb {
  if (!HEX.test(hex)) throw new RangeError(`Not a #RRGGBB colour: ${hex}`)
  const channel = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16)
  return [channel(1), channel(3), channel(5)]
}

function format(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** `color-mix(in srgb, a share%, b)`, rounded to the nearest 8-bit channel. */
export function mixSrgb(a: string, b: string, share: number): string {
  const [x, y] = [parse(a), parse(b)]
  const mix = (i: 0 | 1 | 2) => Math.round((x[i] * share + y[i] * (100 - share)) / 100)
  return format([mix(0), mix(1), mix(2)])
}

/** WCAG 2 relative luminance. */
export function luminance(hex: string): number {
  const linear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = parse(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export type TagChipColors = {
  /** The chip's background: the tag colour 16% into the theme's card. */
  ground: string
  /** The tag colour at 30% over transparent. Decorative, so no ratio applies. */
  border: string
  text: string
  /** The share of tag colour in `text`, in percent; 0 means plain ink. */
  textShare: number
  /** `text` against `ground`. */
  ratio: number
}

/**
 * The chip's colours in one theme. The text starts at the theme's share of tag colour mixed into
 * the ink and steps down 5 points until it clears 4.5:1 against the ground; at 0% it is plain ink.
 */
export function tagChipColors(color: string, theme: ThemeName): TagChipColors {
  const { card, ink, textShare: start } = CHIP_THEMES[theme]
  const ground = mixSrgb(color, card, GROUND_SHARE)
  const [r, g, b] = parse(color)
  const border = `rgb(${r} ${g} ${b} / ${BORDER_ALPHA}%)`

  let share = start
  let text = mixSrgb(color, ink, share)
  let ratio = contrastRatio(text, ground)
  while (ratio < TEXT_CONTRAST_MIN && share > 0) {
    share = Math.max(0, share - STEP)
    text = mixSrgb(color, ink, share)
    ratio = contrastRatio(text, ground)
  }
  return { ground, border, text, textShare: share, ratio }
}
