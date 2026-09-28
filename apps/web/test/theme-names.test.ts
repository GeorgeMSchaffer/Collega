import { THEME_NAMES } from '@collega/design-system'
import { describe, expect, it } from 'vitest'
import { THEMES } from '@/lib/theme'

// The design system computes chip colours per theme and so keeps its own list of theme names.
describe('the design system names the picker’s themes', () => {
  it('in the same order', () => {
    expect(THEMES.map((theme) => theme.value)).toEqual([...THEME_NAMES])
  })
})
