'use client'

import { THEMES, type Theme } from '@/lib/theme'
import { useTheme } from './theme-provider'

const GROUPS = ['Light', 'Dark'] as const

/** Comp R's `.themepick`: a labelled native select, grouped Light / Dark, at the right of the top bar. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <label
      htmlFor="theme-picker"
      className="m-0 inline-flex items-center gap-1.5 text-[13px] font-normal text-muted-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
      </svg>
      Theme
      <select
        id="theme-picker"
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
        className="h-[var(--control-h-sm)] w-auto cursor-pointer rounded-full py-0 text-[13px] text-foreground"
      >
        {GROUPS.map((group) => (
          <optgroup key={group} label={group}>
            {THEMES.filter((t) => t.group === group).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
