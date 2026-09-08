'use client'

/**
 * The last boundary, for a failure in the root layout itself.
 *
 * It replaces the whole document, so it renders its own `<html>` and `<body>` and cannot use the
 * design system: if the root layout threw, `globals.css` is exactly what may not have loaded.
 * Everything here is inline for that reason, and it is deliberately plain — this is the screen
 * that must work when nothing else does.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '3rem 1.5rem' }}>
        <main style={{ margin: '0 auto', maxWidth: '40rem' }}>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#555', margin: '0 0 1rem' }}>
            Collega could not start rendering. Nothing you were looking at has been changed.
            {error.digest ? ` Reference ${error.digest}.` : ''}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: '1px solid #888',
              borderRadius: '0.375rem',
              background: 'transparent',
              cursor: 'pointer',
              padding: '0.5rem 0.875rem',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
