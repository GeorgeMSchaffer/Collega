import type { Route } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getBoardSprint, getIssue } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

/**
 * The old address of one Issue, kept for existing links. An Issue now opens in the drawer
 * (`20-feature-issues-and-delivery.md` "The Issue in the drawer"), so this sends the reader to the
 * screen it sits on — the Sprint board when it is in the sprint that board shows, the Backlog
 * otherwise — with `?idea=` opening it there, as `/ideas/{id}` does for an idea.
 */
export default async function IssuePage({ params }: { params: Promise<{ ideaId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { ideaId } = await params
  const [issue, boardSprint] = await Promise.all([getIssue(ideaId), getBoardSprint()])
  if (!issue) notFound()

  const screen =
    issue.sprint && issue.sprint.id === boardSprint?.id ? '/delivery/sprint' : '/delivery/backlog'
  redirect(`${screen}?idea=${encodeURIComponent(issue.id)}` as Route)
}
