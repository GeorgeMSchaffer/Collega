import { Button } from '@collega/design-system'

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Publish</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="outline">Run safety probes</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Archive board</Button>
    <Button variant="link">See the backlog</Button>
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="More actions">
      ⋯
    </Button>
  </div>
)

/**
 * The denied state. Collega shows an action a role may not take as `aria-disabled`, never
 * `disabled` — the control has to stay focusable so the reason beside it is reachable.
 */
export const Denied = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button aria-disabled="true">Plan a sprint</Button>
    <Button variant="outline" aria-disabled="true">
      Set outcome
    </Button>
    <Button disabled>Truly disabled</Button>
  </div>
)
