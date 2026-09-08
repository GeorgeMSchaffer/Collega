import { buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'

export const metadata = { title: 'Not found · Collega' }

/**
 * Reached by `notFound()` and by any unrouted URL.
 *
 * It renders outside the desk shell, because a 404 can be reached without a session and the
 * sidebar would be a promise the page cannot keep. Home is the one link offered for the same
 * reason: it is the only destination certain to exist for whoever is reading.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-6">
      <div>
        <h1>Not found</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          That address does not match anything here.
        </p>
      </div>
      <EmptyState
        heading="Nothing at this address"
        action={
          <Link href="/home" className={buttonVariants()}>
            Go to Home
          </Link>
        }
      >
        The record may have been deleted, or the link may be wrong. Nothing has gone wrong with the
        application &mdash; it simply has nothing to show at this URL.
      </EmptyState>
    </main>
  )
}
