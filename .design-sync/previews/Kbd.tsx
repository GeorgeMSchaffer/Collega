import { Kbd } from '@collega/design-system'

/** A keycap. Collega renders the command palette shortcut this way in the sidebar. */
export const Shortcut = () => (
  <div className="flex items-center gap-1 text-sm">
    <Kbd>Ctrl</Kbd>
    <Kbd>K</Kbd>
  </div>
)

export const InProse = () => (
  <p className="m-0 max-w-prose text-sm text-muted-foreground">
    Press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> from anywhere to open the command palette, or{' '}
    <Kbd>Esc</Kbd> to close it.
  </p>
)

export const Keys = () => (
  <div className="flex flex-wrap items-center gap-1">
    <Kbd>Ctrl</Kbd>
    <Kbd>Shift</Kbd>
    <Kbd>Esc</Kbd>
    <Kbd>Enter</Kbd>
    <Kbd>/</Kbd>
  </div>
)
