'use client'

import { cn } from '@collega/design-system'
import type { MouseEvent } from 'react'
import { Icon, type IconName } from './icons'

/** Receives the button, so a drawer or dialog opened from it can return focus there on close. */
export type RowAction = (trigger: HTMLButtonElement) => void

const REMOVE: Record<'delete' | 'archive' | 'unarchive', { icon: IconName; label: string }> = {
  delete: { icon: 'trash', label: 'Delete' },
  archive: { icon: 'archive', label: 'Archive' },
  unarchive: { icon: 'unarchive', label: 'Unarchive' },
}

/**
 * Comp R's row actions: View (eye), Edit (pencil), and Delete (trash) or Archive / Unarchive, as
 * icon buttons named for the item ("Edit Assembly cell reliability").
 *
 * Edit and the destructive action are **hidden**, not disabled, for a role that may not use them —
 * the Denied rule's row-action exception (`SPEC/20-feature-client-ui.md`). The `can…` props are that
 * decision, made by the screen from the API's answer; this component only honours it. An action
 * with no handler is not rendered either.
 */
export function RowActions({
  itemLabel,
  onView,
  onEdit,
  onRemove,
  removeKind = 'delete',
  canEdit = true,
  canRemove = true,
}: {
  /** The item's name as a reader would say it; completes each button's accessible name. */
  itemLabel: string
  onView?: RowAction
  onEdit?: RowAction
  onRemove?: RowAction
  removeKind?: 'delete' | 'archive' | 'unarchive'
  canEdit?: boolean
  canRemove?: boolean
}) {
  const remove = REMOVE[removeKind]

  return (
    <span className="inline-flex items-center gap-0.5">
      {onView ? <ActionButton icon="eye" label="View" item={itemLabel} run={onView} /> : null}
      {onEdit && canEdit ? (
        <ActionButton icon="edit" label="Edit" item={itemLabel} run={onEdit} />
      ) : null}
      {onRemove && canRemove ? (
        <ActionButton
          icon={remove.icon}
          label={remove.label}
          item={itemLabel}
          run={onRemove}
          destructive={removeKind === 'delete'}
        />
      ) : null}
    </span>
  )
}

function ActionButton({
  icon,
  label,
  item,
  run,
  destructive = false,
}: {
  icon: IconName
  label: string
  item: string
  run: RowAction
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={`${label} ${item}`}
      title={label}
      onClick={(event: MouseEvent<HTMLButtonElement>) => run(event.currentTarget)}
      className={cn(
        'inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
        destructive && 'hover:bg-destructive/10 hover:text-destructive',
      )}
    >
      <Icon name={icon} />
    </button>
  )
}
