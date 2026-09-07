import { Avatar, Dot, Marker } from '@collega/design-system'
import Link from 'next/link'
import { boardById, type Idea, PRIORITY_COLORS, statusById } from '@/lib/mock'

/**
 * The organization-wide ideas table, shared by `/ideas` and `/ideas/[id]`.
 *
 * `selectedId` marks the row the inspector is showing. Comp P marks it with a left rule plus a soft
 * ground — two channels, so it survives greyscale and does not rely on colour alone.
 */
export function IdeasTable({ rows, selectedId }: { rows: Idea[]; selectedId?: string }) {
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
            const status = statusById(idea.statusId)
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
                    {boardById(idea.boardId)?.name} · {idea.ideaType}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {boardById(idea.boardId)?.name}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Dot color={status?.color} />
                    {status?.name}
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
