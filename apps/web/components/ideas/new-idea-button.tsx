import { Button, Denied } from '@collega/design-system'
import { currentUser, writeDenial } from '@/lib/mock'

/**
 * "New idea", gated by role. A Site Admin sits outside every organization and a Read Only account
 * cannot author, so for both the button is disabled with its reason beside it rather than hidden
 * (see `Denied`).
 */
export function NewIdeaButton({ id }: { id: string }) {
  const denial = writeDenial(currentUser.role)

  if (!denial) {
    return <Button>New idea</Button>
  }

  return (
    <Denied reason={denial} id={id}>
      <Button aria-disabled="true" aria-describedby={id}>
        New idea
      </Button>
    </Denied>
  )
}
