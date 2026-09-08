import { SkeletonRegion, SkeletonRows } from '@collega/design-system'
import { Topbar } from '@/components/nav/topbar'

/**
 * The desk's fallback loading state.
 *
 * One boundary under the layout rather than one per leaf: the sidebar and topbar are already
 * rendered by then, so only the content area waits, and a reader sees the shell immediately
 * instead of a blank page. Screens whose shape differs enough to matter — a table rather than a
 * card — override this in their own segment.
 */
export default function DeskLoading() {
  return (
    <>
      <Topbar title="Collega" />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <SkeletonRegion label="Loading the page" className="gap-4">
          <SkeletonRows rows={2} className="max-w-md" />
          <div className="rounded-lg border bg-card p-4">
            <SkeletonRows rows={5} />
          </div>
        </SkeletonRegion>
      </main>
    </>
  )
}
