'use client'

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_THEME, THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from '@/lib/theme'

type ThemeState = { theme: Theme; setTheme: (theme: Theme) => void }

/** The attribute switches the token block at once; the cookie makes the next server render agree. */
function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  // biome-ignore lint/suspicious/noDocumentCookie: a non-sensitive preference the server reads back; the Cookie Store API is not in every supported browser
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
}

// Outside the root layout's provider (a component rendered on its own) the picker still works; it
// just starts from the default.
const ThemeContext = createContext<ThemeState>({ theme: DEFAULT_THEME, setTheme: applyTheme })

/** Holds the theme the root layout read from the cookie, and changes it without a round trip. */
export function ThemeProvider({ theme: initial, children }: { theme: Theme; children: ReactNode }) {
  const [theme, setState] = useState(initial)

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    setState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext)
}
