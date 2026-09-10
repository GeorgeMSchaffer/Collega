import { Avatar, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import type { Board, Idea } from '@/lib/data'
import { PRIORITY_COLORS } from '@/lib/display'
import { pageQuery } from '@/lib/paging'

/**
 * The organization-wide ideas table, shared by `/ideas` and `/ideas/[id]`.
 *
 * `selectedId` marks the row the inspector is showing. Comp P marks it with a left rule plus a soft
 * ground — two channels, so it survives greyscale and does not rely on colour alone.
 *
 * `page` is carried into every row link so opening an idea from page three lands on a companion
 * table showing page three, with the row still in it.
 *
 * The status swatch is deliberately uncoloured. A row reads its status **name** off the idea, but
 * neither ideas endpoint carries a colour, and this screen spans every board in the organization —
 * so there is no catalog already in hand to join against. A neutral dot beside a real name is
 * honest; a coloured one would need a request this screen does not make.
 */
export function IdeasTable({
  rows,
  boards,
  page = 1,
  selectedId,
}: {
  rows: Idea[]
  boards: Board[]
  page?: number
  selectedId?: string
}) {
  // Presentational, and takes its lookups rather than reading them. The caller already fetches
  // the boards once, so indexing here costs nothing and a row-level reader would have been one
  // request per idea. Staying synchronous is the other half of the reason: an async component
  // cannot be rendered by Testing Library, and the eight tests holding the selection contract
  // in place all render this directly.
  const boardsById = new Map(boards.map((board) => [board.id, board]))

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Title
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Board
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Priority
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Assignee
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Votes
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((idea) => {
            const selected = idea.id === selectedId
            return (
              <tr
                key={idea.id}
                aria-current={selected ? 'true' : undefined}
                className="border-b last:border-0 hover:bg-muted/30 aria-[current]:bg-accent/60"
              >
                <td
                  className={`px-4 py-2.5 ${selected ? 'border-l-[3px] border-l-primary pl-[13px]' : ''}`}
                >
                  <Link href={`/ideas/${idea.id}${pageQuery(page)}`}>{idea.title}</Link>
                  <div className="text-xs text-muted-foreground">
                    {boardsById.get(idea.boardId)?.name} · {idea.ideaType}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {boardsById.get(idea.boardId)?.name}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Dot />
                    {idea.statusName}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Marker>
                    <Dot color={PRIORITY_COLORS[idea.priority]} />
                    {idea.priority}
                  </Marker>
                </td>
                <td className="px-4 py-2.5">
                  {idea.assigneeInitials ? (
                    <Avatar initials={idea.assigneeInitials} className="size-6 text-[10px]" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{idea.upvotes}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
