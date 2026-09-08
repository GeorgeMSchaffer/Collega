'use client'

import { Button, ErrorState } from '@collega/design-system'
import { useEffect } from 'react'

/**
 * The body of an `error.tsx`, shared so every route recovers the same way.
 *
 * Next requires an error boundary to be a client component and hands it `reset`, which re-renders
 * the segment. That is the retry — a link back to the same URL would not be, because the failed
 * render is already the current URL and clicking it changes nothing.
 *
 * The copy carries comp Q's distinction, and it is the load-bearing part: a read that failed
 * leaves nothing **stale**, only absent. A reader who does not know that has to wonder whether the
 * screen is showing them old data, and wondering is worse than the outage.
 *
 * `error.digest` is what the server gives a client boundary in production — the message itself is
 * stripped, so the digest is the only handle that ties what the reader saw to a server log.
 */
export function RouteError({
  what,
  error,
  reset,
}: {
  /** What failed to load, lower case, as it reads after "Couldn't load ". */
  what: string
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Wave D replaces this with real reporting. Until then the console is the only place a
    // failure surfaces at all, and a boundary that swallows it silently is worse than noisy.
    console.error(`[collega] failed to load ${what}`, error)
  }, [error, what])

  return (
    <ErrorState heading={`Couldn’t load ${what}.`} action={<Button onClick={reset}>Retry</Button>}>
      The request failed before anything was returned, so nothing here is out of date — it is simply
      absent. Retrying is safe.
      {error.digest ? (
        <>
          {' '}
          Reference <code className="font-mono text-xs">{error.digest}</code>.
        </>
      ) : null}
    </ErrorState>
  )
}
