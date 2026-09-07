import { Avatar, Button, Dot, Marker, Tag } from '@collega/design-system'
import Link from 'next/link'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { boardById, ideas, statusById } from '@/lib/mock'

export const metadata = { title: 'Ideas · Collega' }

/**
 * The organization-wide ideas list — every board, not one (comp Q `s-ideas`). The board column is
 * what distinguishes it from a board's own lane view, so it stays even when only one board exists.
 */
export default function IdeasPage() {
  return (
    <>
      <Topbar
        title="Ideas"
        actions={
          <>
            <Link href="/boards">
              <Button variant="outline">Lane view</Button>
            </Link>
            <Button variant="outline">Export CSV</Button>
            <NewIdeaButton id="why-new-ideas" />
          </>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>Ideas</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {ideas.length} ideas across every board in this organization.
          </p>
        </div>

        {/* The table scrolls inside its own container so the page never scrolls sideways. */}
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Board</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Tag</th>
                <th className="px-4 py-2.5 font-medium">Assignee</th>
                <th className="px-4 py-2.5 text-right font-medium">Votes</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((idea) => {
                const status = statusById(idea.statusId)
                return (
                  <tr key={idea.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/ideas/${idea.id}`}>{idea.title}</Link>
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
                      <Marker>{idea.priority}</Marker>
                    </td>
                    <td className="px-4 py-2.5">
                      <Tag>{idea.tag}</Tag>
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
      </main>
    </>
  )
}
