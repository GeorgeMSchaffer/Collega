/**
 * The themes the picker offers (`SPEC/20-feature-client-ui.md` "Themes"). Each value is a
 * `[data-theme]` block in `@collega/design-system/globals.css`; this list only names them.
 *
 * Remembered per browser in a cookie rather than on the profile (answered 2026-09-27), so the root
 * layout can read it and render the chosen theme on the first paint.
 */
export const THEMES = [
  { value: 'terrazzo', label: 'Terrazzo', group: 'Light' },
  { value: 'portico', label: 'Portico', group: 'Light' },
  { value: 'sera', label: 'Piazza Sera', group: 'Light' },
  { value: 'lagoon', label: 'Lagoon', group: 'Light' },
  { value: 'notte', label: 'Notte', group: 'Dark' },
] as const

export type Theme = (typeof THEMES)[number]['value']

export const DEFAULT_THEME: Theme = 'terrazzo'

export const THEME_COOKIE = 'collega-theme'

/** A year: the choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Anything else — a stale or hand-edited cookie — falls back to the default. */
export function toTheme(value: string | undefined): Theme {
  return THEMES.some((theme) => theme.value === value) ? (value as Theme) : DEFAULT_THEME
}
