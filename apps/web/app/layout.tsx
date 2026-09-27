import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { currentTheme } from '@/lib/server/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'Collega',
  description: 'Organization-scoped collaboration and idea tracking.',
}

/**
 * Every theme's faces in one stylesheet (`SPEC/20-feature-client-ui.md` "Typography"). A browser
 * downloads only the font files the active theme actually uses, so listing all five costs one CSS
 * request. Adding a theme with a new face means adding it here.
 */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700&family=Public+Sans:wght@400;500;600;700' +
  '&family=Outfit:wght@500;600&family=Figtree:wght@400;500;600;700' +
  '&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700' +
  '&family=Lexend:wght@500;600&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700' +
  '&family=DM+Mono:wght@400;500&display=swap'

/**
 * The root layout. It owns the document shell and the theme, and nothing else — the desk
 * shell (sidebar, command palette) is E2's `(desk)/layout.tsx`, which renders into this.
 *
 * The theme comes from a cookie read here, so `<html data-theme>` is already right in the first
 * response and nothing repaints after hydration. Fonts load by stylesheet rather than `next/font`,
 * the way the comps load them, so the rendered result and the comps stay comparable.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await currentTheme()

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  )
}
