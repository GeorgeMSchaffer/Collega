import { Button, EmptyState } from '@collega/design-system'

/**
 * The administrator's view: the same explanation, plus the action they are allowed to take.
 */
export const WithAction = () => (
  <EmptyState
    heading="No outcomes yet"
    action={<Button variant="outline">Add the first outcome</Button>}
  >
    An outcome is a named, dated theme &mdash; &ldquo;cut reporting effort&rdquo; &mdash; that
    issues are grouped under. Northwind has 14 delivery issues and nothing to group them by.
  </EmptyState>
)

/**
 * The member's view of the same screen. The action is omitted rather than shown refusing them —
 * whether one belongs is a role question, not a layout one.
 */
export const WithoutAction = () => (
  <EmptyState heading="No outcomes yet">
    An outcome is a named, dated theme &mdash; &ldquo;cut reporting effort&rdquo; &mdash; that
    issues are grouped under. Ask an administrator to add the first one.
  </EmptyState>
)

export const Compact = () => (
  <EmptyState heading="Nothing waiting" action={<Button variant="outline">Open the ideas board</Button>}>
    Ideas accepted for delivery land here.
  </EmptyState>
)
