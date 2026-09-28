import { Alert } from '@collega/design-system'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { AddIdeaButton } from '@/components/ideas/add-idea-button'
import { IDEAS_LIST, toIdeaListQuery } from '@/components/ideas/idea-list-config'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { loadIdeaDrawer } from '@/components/ideas/load-idea-drawer'
import { readListState } from '@/components/list/list-state'
import { Topbar } from '@/components/nav/topbar'
import { getBoardRefs, getIdeaList, getStatuses, getTagRefs } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, writeDenial } from '@/lib/session'

export const metadata = { title: 'Ideas · Collega' }

/**
 * Every idea on every board (comp R): List by default, Cards beside it, filtered, sorted and paged
 * in the API from the URL, with the idea drawer over the list. `/ideas/{id}` redirects here with
 * `?idea={id}`.
 */
export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const params = await searchParams
  const user = currentUser()
  const roleDenial = writeDenial(user.role)
  const state = readListState(params, IDEAS_LIST)
  const query = toIdeaListQuery(state)

  const [first, boards, statuses, tags, drawer] = await Promise.all([
    getIdeaList(query),
    getBoardRefs(),
    getStatuses(),
    getTagRefs(),
    loadIdeaDrawer(params, roleDenial === null),
  ])

  // A page past the end — a shared link to page 7 of a list now three pages long — shows the last
  // page rather than an empty table under a pager claiming rows 61–70.
  const lastPage = Math.max(1, Math.ceil(first.totalCount / query.pageSize))
  const ideas =
    first.ideas.length === 0 && query.page > lastPage
      ? await getIdeaList({ ...query, page: lastPage })
      : first

  return (
    <>
      <Topbar title={<b>Ideas</b>} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title="Ideas"
          description="Every idea on every board. Filter, sort, or open one to read and edit it."
          action={
            roleDenial ? (
              <GatedAction id="why-new-ideas" label="Add New Idea" denial={roleDenial} />
            ) : (
              <AddIdeaButton />
            )
          }
        />
        {drawer.missing ? (
          <Alert role="status">
            <span>
              That idea could not be opened. It may have been deleted, or it is not yours to see.
            </span>
          </Alert>
        ) : null}
        <IdeaWorkspace
          rows={ideas.ideas}
          total={ideas.totalCount}
          boards={boards}
          statuses={statuses}
          tags={tags}
          board={null}
          drawer={drawer}
        />
      </main>
    </>
  )
}
