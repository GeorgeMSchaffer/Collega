import { Icon } from '@/components/list/icons'

/**
 * The mark a Restricted board carries in the board lists and its header (BAG-6c). Only ever drawn
 * for someone who can see the board, since nobody else is shown the board at all.
 */
export function LockMark({ className = 'size-3.5' }: { className?: string }) {
  return (
    <span
      className="inline-flex text-muted-foreground"
      title="Restricted: only chosen people and groups"
    >
      <Icon name="lock" className={className} />
      <span className="sr-only">Restricted</span>
    </span>
  )
}
