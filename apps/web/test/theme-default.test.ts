import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, toTheme } from '@/lib/theme'

/** `SPEC/decisions.md` 2026-10-04: Graphite is the default; a browser that picked a theme keeps it. */
describe('the default theme', () => {
  it('is Graphite', () => {
    expect(DEFAULT_THEME).toBe('graphite')
  })

  it('is what a browser with no theme cookie gets', () => {
    expect(toTheme(undefined)).toBe('graphite')
  })

  it.each(['', 'neon', 'GRAPHITE', 'toString', '__proto__'])(
    'is what a stale or hand-edited cookie %j falls back to',
    (cookie) => {
      expect(toTheme(cookie)).toBe('graphite')
    },
  )

  it.each(THEMES.map((theme) => theme.value))('does not override a chosen %s', (value) => {
    expect(toTheme(value)).toBe(value)
  })

  it('keeps a browser that chose the retired Notte on the dark theme', () => {
    expect(toTheme('notte')).toBe('graphite')
  })
})
