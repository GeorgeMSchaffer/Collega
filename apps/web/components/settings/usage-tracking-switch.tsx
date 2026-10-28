'use client'

import { Switch } from '@collega/design-system'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { setUsageTracking } from '@/lib/server/usage-actions'

/**
 * "Record how I use Collega" (`SPEC/20-feature-analytics.md` rule 11). Flips at once and flips back
 * with a message if the save is refused. `refused` is set under View As, where the switch is the
 * user's and not the caller's.
 */
export function UsageTrackingSwitch({ enabled, refused }: { enabled: boolean; refused: boolean }) {
  const [checked, setChecked] = useState(enabled)
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

  return (
    <div>
      <Switch
        checked={checked}
        onCheckedChange={change}
        aria-disabled={refused || pending}
        aria-describedby="usage-tracking-hint"
      >
        Record how I use Collega
      </Switch>
      <p id="usage-tracking-hint" className="m-0 mt-1 max-w-prose text-xs text-muted-foreground">
        {refused
          ? 'Only the account holder can change this, not someone acting as them.'
          : 'Notes which boards, ideas and screens you view, never what you type. Turning it off stops recording at once and deletes nothing already kept.'}{' '}
        <Link href="/privacy">Privacy</Link>
      </p>
      {error ? (
        <p role="alert" className="m-0 mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
