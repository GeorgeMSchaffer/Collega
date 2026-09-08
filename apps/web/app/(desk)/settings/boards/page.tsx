import { Badge, buttonVariants } from '@collega/design-system'
import Link from 'next/link'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { boardAdmin, boardById, currentUser } from '@/lib/mock'

export const metadata = { title: 'Boards · Collega' }

export default function SettingsBoardsPage() {
  // A Site Admin passes the administrator gate, so the branch has to be taken here rather than
  // left to `SettingsPage` - otherwise the one role with no organization gets the org-scoped screen.
  const siteAdmin = currentUser.role === 'SiteAdmin'

  return (
    <SettingsPage
      title="Boards"
      gate="boards"
      lead={
        siteAdmin
          ? 'There is no cross-organization board view.'
          : 'The boards your organization tracks ideas on. Each one picks its own swimlanes from the shared set of statuses.'
      }
      actions={
        siteAdmin ? undefined : (
          <Link href="/settings/boards/new" className={buttonVariants()}>
            New board
          </Link>
        )
      }
    >
      {siteAdmin ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8">
          <h3 className="m-0 text-base font-semibold">This route has no Site Admin story</h3>
          <p className="m-0 max-w-prose text-sm text-muted-foreground">
            Board administration is scoped to one organization, and a Site Admin belongs to none, so
            there is no organization to list here. The product agrees, and routes you elsewhere: the
            Settings hub sends a Site Admin to the workspace boards list rather than here.
          </p>
          <Link href="/boards" className={buttonVariants({ variant: 'outline' })}>
            Go to the boards list
          </Link>
        </div>
      ) : (
        <AdminTable summary="A board’s swimlanes are a subset of the organization’s statuses, in an order chosen per board.">
          <thead>
            <tr className="border-b bg-muted/40">
              <Th>Board</Th>
              <Th className="w-32">Swimlanes</Th>
              <Th className="w-44">User status moves</Th>
              <Th className="w-24">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {boardAdmin.map((entry) => {
              const name = boardById(entry.id)?.name ?? entry.id
              return (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <b className="font-medium">{name}</b>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{entry.swimlaneIds.length}</td>
                  <td className="px-4 py-2.5">
                    {entry.userStatusMoves ? (
                      <Badge variant="success">Allowed</Badge>
                    ) : (
                      <Badge variant="outline">Admins only</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/settings/boards/${entry.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      aria-label={`Edit ${name}`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>
      )}
    </SettingsPage>
  )
}
