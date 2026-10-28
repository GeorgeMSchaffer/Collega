'use client'

import { Switch } from '@collega/design-system'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { setUsageTracking } from '@/lib/server/usage-actions'

/**
 * "Record how I use Collega" (`SPEC/20-feature-analytics.md` rule 11). Flips at once and flips back
 * with a message if the save is refused. `enabled` is `null` under View As: the switch is the
 * user's, the API does not show it to whoever acts as them, so no state is shown either.
 */
export function UsageTrackingSwitch({ enabled }: { enabled: boolean | null }) {
  const refused = enabled === null
  const [checked, setChecked] = useState(enabled ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function change(next: boolean) {
    setChecked(next)
    setError(null)
    startTransition(async () => {
      const refusal = await setUsageTracking(next)
      if (refusal) {
        setChecked(!next)
        setError(refusal)
      }
    })
  }

  if (refused) {
    return (
      <p className="m-0 max-w-prose text-sm text-muted-foreground">
        Only the account holder can see or change this, not someone acting as them.{' '}
        <Link href="/privacy">Privacy</Link>
      </p>
    )
  }

  return (
    <div>
      <Switch
        checked={checked}
        onCheckedChange={change}
        aria-disabled={pending}
        aria-describedby="usage-tracking-hint"
      >
        Record how I use Collega
      </Switch>
      <p id="usage-tracking-hint" className="m-0 mt-1 max-w-prose text-xs text-muted-foreground">
        Notes which boards, ideas and screens you view, never what you type. Turning it off stops
        recording at once and deletes nothing already kept. <Link href="/privacy">Privacy</Link>
      </p>
      {error ? (
        <p role="alert" className="m-0 mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
