import Link from 'next/link'

export type BoardsView = 'cards' | 'list'

/**
 * Cards or list, as a pair of links rather than client state: the view is a URL (`?view=list`),
 * so the server renders the right one first time, and a link to the list opens the list.
 */
export function ViewToggle({ view }: { view: BoardsView }) {
  const option = (value: BoardsView, label: string) => (
    <Link
      href={value === 'cards' ? '/boards' : '/boards?view=list'}
      aria-current={view === value ? 'page' : undefined}
      className="rounded-[calc(var(--radius)-2px)] px-3 py-1 text-sm font-medium text-muted-foreground no-underline hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
    >
      {label}
    </Link>
  )

  return (
    <nav aria-label="Boards view" className="inline-flex gap-0.5 rounded-md border bg-muted p-0.5">
      {option('cards', 'Cards')}
      {option('list', 'List')}
    </nav>
  )
}
