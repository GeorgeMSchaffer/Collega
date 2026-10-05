import { Alert } from '@collega/design-system'
import { DRAWER_PARAMS } from '@/components/ideas/idea-list-config'
import { loadIdeaDrawer } from '@/components/ideas/load-idea-drawer'
import { INBOX_LIST } from '@/components/inbox/inbox-list-config'
import { InboxWorkspace } from '@/components/inbox/inbox-workspace'
import { readListState } from '@/components/list/list-state'
import { Topbar } from '@/components/nav/topbar'
import { getBoardRefs, getInbox, getStatuses, getUnreadCount } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, writeDenial } from '@/lib/session'

export const metadata = { title: 'Inbox · Collega' }

/**
 * The caller's notifications (comp `comp-r-inbox.html`; `20-feature-idea-following.md` rules
 * 40–44): newest first, paged, with the idea drawer over the list at `/inbox?idea={id}` so working
 * down it keeps its place (Q10).
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const params = await searchParams
  const user = currentUser()
  const state = readListState(params, INBOX_LIST)

  // The drawer opens ideas here, to read or edit; creating one belongs on Ideas or a board.
  const [first, unread, drawer] = await Promise.all([
    getInbox({ page: state.page, pageSize: state.size }),
    getUnreadCount(),
    loadIdeaDrawer(
      { ...params, [DRAWER_PARAMS.create]: undefined },
      writeDenial(user.role) === null,
    ),
  ])

  // A page past the end shows the last page, as the idea lists do.
  const lastPage = Math.max(1, Math.ceil(first.totalCount / state.size))
  const inbox =
    first.items.length === 0 && state.page > lastPage
      ? await getInbox({ page: lastPage, pageSize: state.size })
      : first

  // The drawer's eyebrow names the board and colours the lane; only worth asking when it is open.
  const [boards, statuses] = drawer.idea
    ? await Promise.all([getBoardRefs(), getStatuses()])
    : [[], []]

  return (
    <>
      <Topbar title={<b>Inbox</b>} />
      <main className="flex min-w-0 max-w-[960px] flex-1 flex-col gap-4 p-6 max-md:px-4">
        {drawer.missing ? (
          <Alert role="status">
            <span>
              That idea could not be opened. It may have been deleted, or it is not yours to see.
            </span>
          </Alert>
        ) : null}
        <InboxWorkspace
          rows={inbox.items}
          total={inbox.totalCount}
          unread={unread}
          boards={boards}
          statuses={statuses}
          drawer={drawer}
        />
      </main>
    </>
  )
}
