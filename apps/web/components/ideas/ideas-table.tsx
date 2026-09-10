import { Avatar, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import type { Board, Idea, Status } from '@/lib/data'
import { PRIORITY_COLORS } from '@/lib/display'

/**
 * The organization-wide ideas table, shared by `/ideas` and `/ideas/[id]`.
 *
 * `selectedId` marks the row the inspector is showing. Comp P marks it with a left rule plus a soft
 * ground — two channels, so it survives greyscale and does not rely on colour alone.
 */
export function IdeasTable({
  rows,
  boards,
  statuses,
  selectedId,
}: {
  rows: Idea[]
  boards: Board[]
  /**
   * The organization's status colours, for callers that have a catalog.
   *
   * A row reads its own status **name** off the idea, so the join a fixture needed is gone. The
   * swatch beside it is the part with no source: neither ideas endpoint carries a status colour,
   * and asking a separate catalog for one would join real ids against whichever screen's statuses
   * happened to be handed over. Absent, the swatch falls back to a neutral dot, which is honest.
   */
  statuses?: Status[]
  selectedId?: string
}) {
  // Presentational, and takes its lookups rather than reading them. The caller already fetches
  // the boards once, so indexing here costs nothing and a row-level reader would have been one
  // request per idea. Staying synchronous is the other half of the reason: an async component
  // cannot be rendered by Testing Library, and the eight tests holding the selection contract
  // in place all render this directly.
  const boardsById = new Map(boards.map((board) => [board.id, board]))
  const colorByStatusId = new Map((statuses ?? []).map((status) => [status.id, status.color]))

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
                  <Link href={`/ideas/${idea.id}`}>{idea.title}</Link>
                  <div className="text-xs text-muted-foreground">
                    {boardsById.get(idea.boardId)?.name} · {idea.ideaType}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {boardsById.get(idea.boardId)?.name}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Dot color={colorByStatusId.get(idea.statusId)} />
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
