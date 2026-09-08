import type { ReactNode } from 'react'

/**
 * Comp Q's two-column auth frame: the pitch on the left in primary, the form on the right on the
 * canvas. Each page supplies its own pitch copy, because the pitch is the screen's explanation of
 * itself — sign-in and forced password change say different things.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">{children}</div>
}
