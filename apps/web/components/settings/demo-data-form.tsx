'use client'

import { Alert, Button } from '@collega/design-system'
import { useActionState } from 'react'
import { type DemoSeedState, resetDemoData, seedDemoData } from '@/lib/server/demo-seed-actions'

const IDLE: DemoSeedState = { error: null, message: null }

/**
 * The two buttons, and the difference between them stated where it is read.
 *
 * **Separate forms, separate state.** They are separate Server Functions with separate outcomes,
 * and one `useActionState` between them would print a reset's refusal under the seed button. The
 * cost is a few lines; the alternative is a message that lies about which one failed.
 *
 * Reset is not behind a confirmation dialog, and that is a judgement rather than an omission: it
 * deletes only rows the seed itself created, identified by ids derived from the demo organizations'
 * own slugs. Anything made by hand survives it. A dialog would imply a blast radius this does not
 * have — and the sentence beside the button says exactly what it reaches, which a dialog would not.
 */
export function DemoDataForm() {
  const [seedState, seed, seeding] = useActionState(seedDemoData, IDLE)
  const [resetState, reset, resetting] = useActionState(resetDemoData, IDLE)

  return (
    <div className="flex max-w-prose flex-col gap-8">
      <form action={seed} className="flex flex-col gap-3">
        {seedState.error ? <Alert variant="destructive">{seedState.error}</Alert> : null}
        {seedState.message ? <Alert variant="note">{seedState.message}</Alert> : null}

        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-base font-semibold">Add the demo data</h2>
          <p className="m-0 text-sm text-muted-foreground">
            Creates two organizations, ten accounts across them, four boards and the ideas, comments
            and delivery work that make a walkthrough. Safe to run more than once — it leaves
            anything already there alone, and repairs a catalog somebody renamed.
          </p>
        </div>

        <Button type="submit" disabled={seeding} className="w-fit">
          {seeding ? 'Seeding…' : 'Seed demo data'}
        </Button>
      </form>

      <form action={reset} className="flex flex-col gap-3 border-t pt-6">
        {resetState.error ? <Alert variant="destructive">{resetState.error}</Alert> : null}
        {resetState.message ? <Alert variant="note">{resetState.message}</Alert> : null}

        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-base font-semibold">Start the demo over</h2>
          <p className="m-0 text-sm text-muted-foreground">
            Removes the demo organizations and everything in them, then builds them again — so a
            walkthrough starts from the same place every time.{' '}
            <strong className="font-semibold">
              Organizations you created yourself are not touched
            </strong>
            : this reaches only the rows the seed made, which it can identify exactly.
          </p>
        </div>

        <Button type="submit" variant="outline" disabled={resetting} className="w-fit">
          {resetting ? 'Resetting…' : 'Reset demo data'}
        </Button>
      </form>
    </div>
  )
}
