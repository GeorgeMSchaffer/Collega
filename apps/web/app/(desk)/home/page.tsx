import {
  buttonVariants,
  Card,
  CardContent,
  Dot,
  EmptyState,
  Kbd,
  Marker,
} from '@collega/design-system'
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { FirstRunStrip } from '@/components/home/first-run-strip'
import { Topbar } from '@/components/nav/topbar'
import {
  ATTENTION_HREF,
  type AttentionItem,
  getOrganizationHome,
  getPlatformHome,
  type HomeKpi,
  type PlatformBoard,
  type Status,
} from '@/lib/data'
import { compactAge, PRIORITY_COLORS } from '@/lib/display'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Home · Collega' }

/**
 * Home answers *what needs me now*, not *what exists* (`SPEC/20-feature-client-ui.md`, comp Q
 * `s-home`). A Site Admin has no "me" inside any organization, so theirs is the platform roll-up.
 *
 * What the API cannot answer yet renders as not tracked rather than as a guess; `lib/data/home.ts`
 * says which figures those are and why.
 */
export default async function HomePage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  return (
    <>
      <Topbar title={<b>Home</b>} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
        {currentUser().role === 'SiteAdmin' ? <PlatformHomeView /> : <OrganizationHomeView />}
      </main>
    </>
  )
}

function firstName(): string {
  return currentUser().displayName.split(' ')[0] ?? ''
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

async function OrganizationHomeView() {
  const home = await getOrganizationHome()
  const readOnly = currentUser().role === 'ReadOnly'
  const organization = currentUser().organizationName ?? 'Your organization'

  return (
    <>
      <PageHeader
        title={<>Good to see you, {firstName()}.</>}
        description={
          <>
            {readOnly ? 'Here’s what’s moving today.' : 'Here’s what needs you today.'}{' '}
            {organization} has {plural(home.counts.ideas, 'idea', 'ideas')} across{' '}
            {plural(home.counts.boards, 'board', 'boards')} and{' '}
            {plural(home.counts.issues, 'delivery issue', 'delivery issues')} in flight &mdash;
            press <Kbd>Ctrl K</Kbd> to jump straight to any of them.
          </>
        }
      />

      {home.counts.boards === 0 ? (
        <NoBoards />
      ) : (
        <>
          <FirstRunStrip>
            <b>New to Collega?</b> An idea moves{' '}
            {home.statuses.map((status, index) => (
              <Fragment key={status.id}>
                {index > 0 ? ' → ' : null}
                {status.name}
              </Fragment>
            ))}
            , and the people, comments and history stay attached the whole way. Start one from any
            board, or press <Kbd>Ctrl K</Kbd> and type &ldquo;new idea&rdquo;.
          </FirstRunStrip>

          <KpiRow kpis={home.kpis} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel
              heading="Needs your attention"
              standfirst="Critical and high-priority ideas still on a board, oldest first — the longer one waits, the more it needs a decision."
              action={
                <Link
                  href={ATTENTION_HREF}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  View all
                </Link>
              }
            >
              <AttentionQueue rows={home.attention} />
            </Panel>
            <RecentActivity
              standfirst={`Everything anyone changed in ${organization}, newest first. You only see activity on boards you have access to.`}
            />
          </div>
        </>
      )}
    </>
  )
}

async function PlatformHomeView() {
  const home = await getPlatformHome()

  return (
    <>
      <PageHeader
        title={<>Good to see you, {firstName()}.</>}
        description={
          <>
            Platform-wide activity across every organization.{' '}
            {plural(home.counts.organizations, 'organization', 'organizations')},{' '}
            {plural(home.counts.ideas, 'idea', 'ideas')},{' '}
            {plural(home.counts.issues, 'delivery issue', 'delivery issues')}. You are not a member
            of any of them &mdash; to change what they own, act as one of their administrators.
          </>
        }
      />

      {home.counts.organizations === 0 ? (
        <EmptyState
          heading="No organizations yet"
          action={
            <GatedAction id="why-create-organization" label="Create an organization" denial={null}>
              <Link href="/settings/organizations/new" className={buttonVariants()}>
                Create an organization
              </Link>
            </GatedAction>
          }
        >
          Nothing to show until an organization exists. Creating one provisions its default statuses
          and a first board.
        </EmptyState>
      ) : (
        <>
          <KpiRow kpis={home.kpis} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel
              heading="All boards"
              standfirst="Every board in every organization, grouped by organization. Open one to read it; to change it, act as one of its administrators."
            >
              <PlatformBoards boards={home.boards} />
            </Panel>
            <RecentActivity standfirst="Everything anyone changed, in any organization, newest first." />
          </div>
        </>
      )}
    </>
  )
}

/**
 * An organization with no boards. An Org Admin may create one; everyone else gets the same
 * explanation with the action shown and refused, per the "Denied is shown" rule.
 */
function NoBoards() {
  const admin = currentUser().role === 'OrgAdmin'
  return (
    <EmptyState
      heading="No boards yet"
      action={
        <GatedAction
          id="why-create-board"
          label="Create a board"
          denial={admin ? null : 'Administrators only'}
        >
          {admin ? (
            <Link href="/settings/boards/new" className={buttonVariants()}>
              Create a board
            </Link>
          ) : undefined}
        </GatedAction>
      }
    >
      Your organization doesn&rsquo;t have any boards to show. An Org Admin can create boards from
      Settings.
    </EmptyState>
  )
}

function KpiRow({ kpis }: { kpis: HomeKpi[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <li key={kpi.label}>
          <Card className="h-full">
            <CardContent className="flex flex-col gap-1">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {kpi.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {kpi.value === null ? (
                  <span className="text-muted-foreground" aria-hidden="true">
                    &mdash;
                  </span>
                ) : kpi.href ? (
                  <Link href={kpi.href} className="no-underline hover:underline">
                    {kpi.value}
                  </Link>
                ) : (
                  kpi.value
                )}
              </div>
              {kpi.detail ? (
                <div className="text-sm text-muted-foreground">{kpi.detail}</div>
              ) : null}
              <p className="m-0 mt-1 text-xs text-muted-foreground">{kpi.definition}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function Panel({
  heading,
  standfirst,
  action,
  children,
}: {
  heading: string
  standfirst: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="m-0 flex-1 text-base font-semibold">{heading}</h2>
          {action}
        </div>
        <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">{standfirst}</p>
      </div>
      {children}
    </section>
  )
}

function StatusMarker({ status }: { status: Status }) {
  return (
    <Marker>
      <Dot color={status.color} />
      {status.name}
    </Marker>
  )
}

function AttentionQueue({ rows }: { rows: AttentionItem[] }) {
  if (rows.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        Nothing critical or high priority is waiting on a board.
      </p>
    )
  }

  // Server-rendered, so the age is as of this render — the same moment the rows were read.
  const now = new Date()

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Idea
            </th>
            <th scope="col" className="w-44 px-4 py-2.5 text-left font-medium">
              Status
            </th>
            <th scope="col" className="w-28 px-4 py-2.5 text-left font-medium">
              Priority
            </th>
            <th scope="col" className="w-16 px-4 py-2.5 text-right font-medium">
              Age
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <Link href={`/ideas?idea=${encodeURIComponent(row.id)}`} className="font-medium">
                  {row.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {row.boardName ? `${row.boardName} · ` : null}
                  {row.ideaType}
                </div>
              </td>
              <td className="px-4 py-2.5">
                <StatusMarker status={row.status} />
              </td>
              <td className="px-4 py-2.5">
                <Marker>
                  <Dot color={PRIORITY_COLORS[row.priority]} />
                  {row.priority}
                </Marker>
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                {compactAge(row.createdAtUtc, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlatformBoards({ boards }: { boards: PlatformBoard[] }) {
  if (boards.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        No organization has a board yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Board
            </th>
            <th scope="col" className="w-48 px-4 py-2.5 text-left font-medium">
              Organization
            </th>
            <th scope="col" className="w-28 px-4 py-2.5 text-right font-medium">
              Swimlanes
            </th>
          </tr>
        </thead>
        <tbody>
          {boards.map((board) => (
            <tr key={board.id} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <Link href={`/boards/${encodeURIComponent(board.id)}`} className="font-medium">
                  {board.name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{board.organizationName}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{board.laneCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The activity feed comp Q draws has nothing to read: the API records audit events but serves no
 * route over them. The panel keeps its place and says so rather than disappearing.
 */
function RecentActivity({ standfirst }: { standfirst: string }) {
  return (
    <Panel heading="Recent activity" standfirst={standfirst}>
      <p className="m-0 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        Not available yet. Changes to ideas and boards will be listed here once the activity feed is
        switched on.
      </p>
    </Panel>
  )
}
