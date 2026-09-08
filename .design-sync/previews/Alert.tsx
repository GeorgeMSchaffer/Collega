import { Alert } from '@collega/design-system'

export const Variants = () => (
  <div className="flex max-w-xl flex-col gap-3">
    <Alert>Your changes to the intake board were saved.</Alert>
    <Alert variant="destructive">
      Assist is unavailable: the daily token cap was reached at 14:20 UTC.
    </Alert>
    <Alert variant="note">
      The daily cap is a deployment setting, not a per-organization one.
    </Alert>
  </div>
)

/** `note` carries a primary left rule — used for standing explanation rather than an event. */
export const Note = () => (
  <Alert variant="note" className="max-w-xl">
    Read-only accounts can open every board in this organization but cannot post ideas, comment, or
    vote. An administrator can change the role from Settings &rarr; Users.
  </Alert>
)

/**
 * Alert lays its children out as grid rows, so a heading and its explanation each get a row —
 * inline emphasis belongs inside one of them, not as a sibling.
 */
export const Destructive = () => (
  <Alert variant="destructive" className="max-w-xl">
    <span className="font-medium">2 of 48 rows were rejected</span>
    <span>
      users-march.csv held a duplicate email address and a role this deployment does not define.
      Nothing was imported.
    </span>
  </Alert>
)
