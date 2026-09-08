import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Collega',
  description: 'Organization-scoped collaboration and idea tracking.',
}

/**
 * The root layout. It owns the document shell and the theme, and nothing else — the desk
 * shell (sidebar, command palette) is E2's `(desk)/layout.tsx`, which renders into this.
 *
 * Geist is loaded the way the comps load it, by stylesheet rather than `next/font`, so the
 * rendered result and `SPEC/mockups/comp-q-*.html` stay comparable byte for byte.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
