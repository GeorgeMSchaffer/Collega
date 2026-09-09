import { Button, ErrorState } from '@collega/design-system'

/**
 * The wording matters: a failed read leaves nothing stale, only absent. Saying so is what stops a
 * reader wondering whether they are looking at old data.
 */
export const WithRetry = () => (
  <ErrorState heading="Could not load ideas" action={<Button variant="outline">Try again</Button>}>
    The board could not be reached. Nothing here is out of date &mdash; the list simply did not
    load, so retrying is safe.
  </ErrorState>
)

export const WithoutAction = () => (
  <ErrorState heading="Could not load the roadmap">
    The delivery service did not respond. Nothing was changed by the attempt.
  </ErrorState>
)

export const Short = () => (
  <ErrorState heading="Assist is unavailable" action={<Button variant="outline">Retry</Button>}>
    The daily token cap was reached at 14:20 UTC.
  </ErrorState>
)
