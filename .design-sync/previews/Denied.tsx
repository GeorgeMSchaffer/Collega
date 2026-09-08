import { Button, Denied } from '@collega/design-system'

/**
 * The rule Denied encodes: an action a role may not take is shown disabled with the reason beside
 * it, never hidden. The control keeps `aria-describedby` pointed at that reason.
 */
export const ReadOnlyAccount = () => (
  <Denied reason="Read-only account" id="why-plan-sprint">
    <Button aria-disabled="true" aria-describedby="why-plan-sprint">
      Plan a sprint
    </Button>
  </Denied>
)

export const ActAsMember = () => (
  <Denied reason="Act as a member" id="why-set-outcome">
    <Button variant="outline" size="sm" aria-disabled="true" aria-describedby="why-set-outcome">
      Set outcome
    </Button>
  </Denied>
)

export const Both = () => (
  <div className="flex flex-col items-start gap-3">
    <Denied reason="Read-only account" id="why-new-idea">
      <Button aria-disabled="true" aria-describedby="why-new-idea">
        New idea
      </Button>
    </Denied>
    <Denied reason="Act as a member" id="why-move-issue">
      <Button variant="outline" aria-disabled="true" aria-describedby="why-move-issue">
        Move issue
      </Button>
    </Denied>
  </div>
)
