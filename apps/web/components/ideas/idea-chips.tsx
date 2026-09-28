import { Avatar, Dot, Marker, Tag } from '@collega/design-system'
import { PRIORITY_COLORS } from '@/lib/display'
import type { PersonRef, Priority } from '@/lib/types'

/** The markers an idea row, card and drawer share. Each dot has its label beside it. */

export function StatusMarker({ name, color }: { name: string; color?: string | undefined }) {
  return (
    <Marker>
      <Dot color={color} />
      {name}
    </Marker>
  )
}

export function PriorityMarker({ priority }: { priority: Priority }) {
  return (
    <Marker>
      <Dot color={PRIORITY_COLORS[priority]} />
      {priority}
    </Marker>
  )
}

/** The first `max` tags, and `+N` naming the rest for assistive technology. */
export function TagList({ tags, max = 3 }: { tags: readonly string[]; max?: number }) {
  if (tags.length === 0) return null
  const hidden = tags.slice(max)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.slice(0, max).map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
      {hidden.length > 0 ? (
        <span className="text-xs text-muted-foreground" title={hidden.join(', ')}>
          +{hidden.length}
          <span className="sr-only"> more: {hidden.join(', ')}</span>
        </span>
      ) : null}
    </span>
  )
}

/** Overlapping initials, with every name in accessible text. */
export function People({
  people,
  max = 3,
  quiet = false,
}: {
  people: readonly PersonRef[]
  max?: number
  /** Render nothing, rather than "Unassigned", when there is no one — on a card. */
  quiet?: boolean
}) {
  if (people.length === 0) {
    return quiet ? null : <span className="text-xs text-muted-foreground">Unassigned</span>
  }
  return (
    <span className="inline-flex items-center" title={people.map((p) => p.name).join(', ')}>
      {people.slice(0, max).map((person) => (
        <Avatar
          key={person.id}
          initials={person.initials}
          className="-ml-1.5 size-6 border-2 border-card text-[10px] first:ml-0"
        />
      ))}
      {people.length > max ? (
        <span className="ml-1 text-xs text-muted-foreground" aria-hidden="true">
          +{people.length - max}
        </span>
      ) : null}
      <span className="sr-only">{people.map((p) => p.name).join(', ')}</span>
    </span>
  )
}
