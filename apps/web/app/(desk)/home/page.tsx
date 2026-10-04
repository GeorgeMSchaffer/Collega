import { Badge, buttonVariants, Card, EmptyState, Kbd, Meter } from '@collega/design-system'
import Link from 'next/link'
import { Fragment } from 'react'
import {
  CountLegend,
  CountStrip,
  LaneLegend,
  LaneStrip,
  TopTags,
} from '@/components/boards/board-parts'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { FirstRunStrip } from '@/components/home/first-run-strip'
import {
  EmptyNote,
  IdeaRow,
  KpiRow,
  NotAvailable,
  Panel,
  plural,
  Row,
  Rows,
  RowTitle,
  UntrackedTile,
} from '@/components/home/home-parts'
import { Topbar } from '@/components/nav/topbar'
import {
  getOrganizationHome,
  getPlatformHome,
  type HomeSprint,
  type OrganizationHome,
  type PlatformOrganization,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardCreateDenial, currentUser } from '@/lib/session'

export const metadata = { title: 'Home · Collega' }

/**
 * Home answers *what needs me now*, not *what exists* (`SPEC/20-feature-client-ui.md` § Home, with
 * comp R `comp-r-home-dashboard.html` as the visual guide). Every number links to the list that
 * shows what it counts. A Site Admin has no "me" inside any organization, so theirs is the platform
 * roll-up.
 *
 * Two columns from 1100px: the organization's work on the left, the reader's own lists on the
 * right. Below that, one column with the reader's own work first — each column becomes `contents`
 * and the panels take their place by `order`.
 */
export default async function HomePage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  return (
    <>
      <Topbar title={<b>Home</b>} />
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 min-[900px]:p-6">
        {currentUser().role === 'SiteAdmin' ? <PlatformHomeView /> : <OrganizationHomeView />}
      </main>
    </>
  )
}

const DASH = 'grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
const COLUMN =
  'contents min-[1100px]:flex min-[1100px]:min-w-0 min-[1100px]:flex-col min-[1100px]:gap-6'

/** Each panel's place in the one-column order; written out so Tailwind sees every class. */
const ORDER = {
  attention: 'order-1 min-[1100px]:order-none',
  assigned: 'order-2 min-[1100px]:order-none',
  sprint: 'order-3 min-[1100px]:order-none',
  boards: 'order-4 min-[1100px]:order-none',
  voted: 'order-5 min-[1100px]:order-none',
  activity: 'order-6 min-[1100px]:order-none',
}

const SMALL_BUTTON = buttonVariants({ variant: 'outline', size: 'sm' })

/** A count in running text that opens its list; plain text when there is nothing to open. */
function Count({ href, children }: { href: string | null; children: string }) {
  return href ? <Link href={href}>{children}</Link> : <>{children}</>
}

function firstName(): string {
  return currentUser().displayName.split(' ')[0] ?? ''
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
            {organization} has{' '}
            <Count href={home.ideasHref}>{plural(home.counts.ideas, 'idea', 'ideas')}</Count> across{' '}
            <Count href="/boards">{plural(home.counts.boards, 'board', 'boards')}</Count> and{' '}
            <Count href={home.counts.issues > 0 ? '/ideas?phase=Issues' : null}>
              {plural(home.counts.issues, 'delivery issue', 'delivery issues')}
            </Count>{' '}
            &mdash; press <Kbd>Ctrl K</Kbd> to jump straight to any of them.
          </>
        }
      />

      {home.counts.boards === 0 ? <NoBoards /> : <OrganizationDashboard home={home} />}
    </>
  )
}

function OrganizationDashboard({ home }: { home: OrganizationHome }) {
  const role = currentUser().role
  // Server-rendered, so an age is as of this render — the same moment the rows were read.
  const now = new Date()

  return (
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

      <KpiRow label="Your numbers" kpis={home.kpis}>
        <UntrackedTile figures={['Open ideas', 'Awaiting review', 'Completed · 30d']} />
      </KpiRow>

      <div className={DASH}>
        <div className={COLUMN}>
          <Panel
            id="home-attention"
            className={ORDER.attention}
            heading="Needs your attention"
            standfirst="Critical and high-priority ideas still on a board, oldest first — the longer one waits, the more it needs a decision."
          >
            {home.attention.rows.length === 0 ? (
              <EmptyNote>Nothing critical or high priority is waiting on a board.</EmptyNote>
            ) : (
              <Rows
                footer={<Link href={home.attention.href}>View all {home.attention.total}</Link>}
              >
                {home.attention.rows.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} detail="age" now={now} />
                ))}
              </Rows>
            )}
          </Panel>

          <Panel
            id="home-boards"
            className={ORDER.boards}
            heading="Your boards"
            standfirst="Ideas on each board by lane, left to right in lane order."
            action={
              role === 'OrgAdmin' ? (
                <Link href="/settings/boards" className={SMALL_BUTTON}>
                  Manage boards
                </Link>
              ) : (
                <Link href="/boards" className={SMALL_BUTTON}>
                  All boards
                </Link>
              )
            }
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
              {home.boards.map((board) => (
                <Card key={board.id} className="flex flex-col gap-2.5 px-4 py-3.5">
                  <h3 className="m-0 text-base font-semibold">
                    <Link
                      href={`/boards/${board.id}`}
                      className="text-foreground no-underline hover:underline"
                    >
                      {board.name}
                    </Link>
                  </h3>
                  {board.description ? (
                    <p className="m-0 line-clamp-2 text-sm text-muted-foreground">
                      {board.description}
                    </p>
                  ) : null}
                  <LaneStrip board={board} />
                  {board.ideaCount === 0 ? (
                    <p className="m-0 text-xs text-muted-foreground">No ideas yet</p>
                  ) : (
                    <LaneLegend board={board} />
                  )}
                  <TopTags board={board} limit={3} />
                  <div className="mt-auto flex justify-between gap-2 border-t pt-2 text-xs text-muted-foreground tabular-nums">
                    <span>{plural(board.ideaCount, 'idea', 'ideas')}</span>
                    <span>{plural(board.tagCount, 'tag', 'tags')}</span>
                  </div>
                </Card>
              ))}
            </div>
          </Panel>

          <Panel
            id="home-activity"
            className={ORDER.activity}
            heading="Recent activity"
            standfirst="What changed on boards you can see, newest first."
          >
            <NotAvailable>
              Moves, comments and edits will be listed here once the activity feed is switched on.
            </NotAvailable>
          </Panel>
        </div>

        <div className={COLUMN}>
          <Panel
            id="home-assigned"
            className={ORDER.assigned}
            heading={
              <>
                Assigned to me{' '}
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {home.assigned.total}
                </span>
              </>
            }
            standfirst="Highest priority first."
          >
            {home.assigned.rows.length === 0 ? (
              <EmptyNote heading="Nothing is assigned to you.">
                {role === 'ReadOnly'
                  ? 'Ideas you’re named on will appear here.'
                  : 'When someone adds you to an idea’s Assigned field, it lands here. Meanwhile, the queue on the left is a good place to pick something up.'}
              </EmptyNote>
            ) : (
              <Rows footer={<Link href={home.assigned.href}>View all {home.assigned.total}</Link>}>
                {home.assigned.rows.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} detail="priority" now={now} />
                ))}
              </Rows>
            )}
          </Panel>

          {home.sprint ? <CurrentSprint current={home.sprint} className={ORDER.sprint} /> : null}

          <Panel
            id="home-voted"
            className={ORDER.voted}
            heading="Most upvoted"
            standfirst="Ideas on a board with the most upvotes."
          >
            {home.topVoted.length === 0 ? (
              <EmptyNote>No ideas on a board yet.</EmptyNote>
            ) : (
              <Rows>
                {home.topVoted.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} detail="votes" now={now} />
                ))}
              </Rows>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

function CurrentSprint({ current, className }: { current: HomeSprint; className: string }) {
  const { sprint, mix, backlog } = current
  const segments = mix.map(({ status, count }) => ({ ...status, count }))
  const done = sprint.issueCount === 0 ? 0 : (100 * sprint.doneCount) / sprint.issueCount

  return (
    <Panel id="home-sprint" className={className} heading="Current sprint">
      <Card className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <b className="font-heading text-base">{sprint.name}</b>
          <Badge variant="success">Active</Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {sprint.startsOn} – {sprint.endsOn}
        </span>
        {sprint.goal ? <p className="m-0 text-sm">{sprint.goal}</p> : null}
        <Meter pct={done} />
        <div className="flex flex-wrap justify-between gap-1 text-sm">
          <span>
            <b>{sprint.doneCount}</b> of {plural(sprint.issueCount, 'issue', 'issues')} done
          </span>
          <Link href="/delivery/backlog" className="text-muted-foreground">
            {backlog} in the backlog
          </Link>
        </div>
        <CountStrip segments={segments} />
        <CountLegend segments={segments} />
        <div>
          <Link href="/delivery/sprint" className={SMALL_BUTTON}>
            Open sprint board
          </Link>
        </div>
      </Card>
    </Panel>
  )
}

/**
 * An organization with no boards. An Org Admin or a User may create one (2026-10-04); everyone else
 * gets the same explanation with the action shown and refused, per the "Denied is shown" rule.
 */
function NoBoards() {
  const denial = boardCreateDenial(currentUser().role)
  const admin = denial === null
  return (
    <EmptyState
      heading="No boards yet"
      action={
        <GatedAction id="why-create-board" label="Create a board" denial={denial}>
          {admin ? (
            <Link href="/boards?board=new" className={buttonVariants()}>
              Create a board
            </Link>
          ) : undefined}
        </GatedAction>
      }
    >
      Your organization doesn&rsquo;t have any boards to show.{' '}
      {admin
        ? 'Create one to start collecting ideas: it comes with your organization’s statuses as its lanes, and you can change them later.'
        : 'An Org Admin or a contributor can create one from Boards.'}
    </EmptyState>
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
            Platform-wide, across every organization:{' '}
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
          <KpiRow label="Platform numbers" kpis={home.kpis} />
          <div className={DASH}>
            <div className="flex min-w-0 flex-col gap-6">
              <Panel
                id="home-organizations"
                heading="Organizations"
                standfirst="Each organization’s size, largest first by ideas."
              >
                <OrganizationRows organizations={home.organizations} />
              </Panel>
              <Panel
                id="home-all-boards"
                heading="All boards"
                standfirst="Every board, grouped by organization, with its ideas by lane. Open one to read it; to change it, act as one of its administrators."
              >
                {home.organizations.map((organization) => (
                  <OrganizationBoards key={organization.id} organization={organization} />
                ))}
              </Panel>
            </div>
            <Panel
              id="home-activity"
              heading="Recent activity"
              standfirst="Everything anyone changed, in any organization, newest first."
            >
              <NotAvailable>
                Changes in every organization will be listed here once the activity feed is switched
                on.
              </NotAvailable>
            </Panel>
          </div>
        </>
      )}
    </>
  )
}

function OrganizationRows({ organizations }: { organizations: PlatformOrganization[] }) {
  const largest = Math.max(1, ...organizations.map((organization) => organization.ideas))
  return (
    <Rows>
      {organizations.map((organization) => (
        <Row key={organization.id}>
          <RowTitle
            href={`/settings/organizations/${organization.id}`}
            title={organization.name}
            sub={`${plural(organization.boards.length, 'board', 'boards')} · ${plural(organization.users, 'user', 'users')}${organization.inactive ? ` (${organization.inactive} inactive)` : ''}`}
          />
          <span className="flex min-w-40 flex-[0_1_220px] items-center gap-3">
            <Meter pct={(100 * organization.ideas) / largest} className="flex-1" />
            <span className="min-w-16 text-right font-mono text-xs text-muted-foreground">
              {plural(organization.ideas, 'idea', 'ideas')}
            </span>
          </span>
          <span className="min-w-16 text-right font-mono text-xs text-muted-foreground">
            {plural(organization.issues, 'issue', 'issues')}
          </span>
        </Row>
      ))}
    </Rows>
  )
}

function OrganizationBoards({ organization }: { organization: PlatformOrganization }) {
  return (
    <Rows>
      <Row className="bg-muted/40 hover:bg-muted/40">
        <b>{organization.name}</b>
      </Row>
      {organization.boards.length === 0 ? (
        <Row>
          <span className="text-sm text-muted-foreground">No boards yet</span>
        </Row>
      ) : (
        organization.boards.map((board) => (
          <Row key={board.id}>
            <RowTitle
              href={`/boards/${board.id}`}
              title={board.name}
              sub={plural(board.ideaCount, 'idea', 'ideas')}
            />
            <span className="min-w-36 flex-[0_1_220px]">
              {board.ideaCount > 0 ? (
                <>
                  <LaneStrip board={board} />
                  <span className="sr-only">
                    {board.lanes.map((lane) => `${lane.ideaCount} ${lane.name}`).join(', ')}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No ideas yet</span>
              )}
            </span>
          </Row>
        ))
      )}
    </Rows>
  )
}
