'use client'

import { useEffect } from 'react'
import { publishSessionSignal, type SessionEndNotice } from '@/lib/session-signal'

/**
 * Tells the other tabs the session has ended, from the sign-in page.
 *
 * Rendering this page at all means this browser profile holds no session: `proxy.ts` sends a
 * reader with a session cookie on to `/boards`, except on `?expired=1`, where it drops the cookie
 * first. So whichever way the session ended — the idle deadline, an explicit sign-out, a password
 * change, a token the API refused — the first tab to land here can speak for all of them, and the
 * others follow it to the same notice (`SPEC/20-feature-auth.md` requirements 39, 41 and 42).
 */
export function SessionEndedSignal({ notice }: { notice: SessionEndNotice }) {
  useEffect(() => {
    publishSessionSignal({ type: 'ended', notice })
  }, [notice])

  return null
}
