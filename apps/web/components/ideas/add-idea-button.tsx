'use client'

import { Button } from '@collega/design-system'
import { Icon } from '@/components/list/icons'
import { useDrawerUrl } from './use-drawer-url'

/**
 * The page header's "Add New Idea", for a role that may author on a board that is not archived. It
 * opens the drawer's create form; the refused case is the page's `GatedAction`, with its reason.
 */
export function AddIdeaButton() {
  const openDrawer = useDrawerUrl()
  return (
    <Button onClick={() => openDrawer({ create: true })}>
      <Icon name="plus" />
      Add New Idea
    </Button>
  )
}
