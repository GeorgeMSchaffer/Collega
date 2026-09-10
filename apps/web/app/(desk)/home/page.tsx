import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { Topbar } from '@/components/nav/topbar'
import { getBoards, getNavCounts } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Home · Collega' }

const WAVES = [
  { id: 'Wave A', what: 'Golden capture — 447 cases over all 81 endpoints', state: 'done' },
  {
    id: 'Wave 0',
    what: 'Foundation: monorepo, Prisma schema, typed config, kernel',
    state: 'done',
  },
  { id: 'Wave B', what: 'Domain + application, all seven partitions', state: 'done' },
  { id: 'Wave C', what: 'Infrastructure: Prisma adapters, integrations, security', state: 'done' },
  { id: 'Wave D', what: 'The Nest API — 15 controllers, 81 endpoints', state: 'next' },
  {
    id: 'Wave E',
    what: 'This client. E0 theme and E1/E2 shell are in; E3–E6 remain',
    state: 'doing',
  },
  { id: 'Wave F', what: 'Golden replay, cutover, and deleting the .NET solution', state: 'todo' },
] as const

const TONE = {
  done: 'success',
  doing: 'warning',
  next: 'default',
  todo: 'outline',
} as const

/**
 * A Site Admin sits outside every organization, so an empty deployment is a different problem from
 * an empty organization: nothing exists to hold a board yet, and creating the organization is the
 * one write the role does take — the bootstrap exception to "act as a member".
 */
function NoBoards() {
  if (currentUser().role === 'SiteAdmin') {
    return (
      <EmptyState
        heading="No organizations yet"
        action={
          <GatedAction id="why-create-organization" label="Create an organization" denial={null} />
        }
      >
        Nothing to show until an organization exists. Creating one provisions its default statuses
        and a first board.
      </EmptyState>
    )
  }

  return (
    <EmptyState
      heading="No boards yet"
      action={
        <GatedAction
          id="why-create-board"
          label="Create a board"
          denial={currentUser().role === 'OrgAdmin' ? null : 'Administrators only'}
        />
      }
    >
      Your organization doesn&rsquo;t have any boards to show. An Org Admin can create boards from
      Settings.
    </EmptyState>
  )
}

export default async function HomePage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [navCounts, boards] = await Promise.all([getNavCounts(), getBoards()])

  return (
    <>
      <Topbar title="Home" />
      <main className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="mb-1">Good to see you, {currentUser().displayName.split(' ')[0]}.</h2>
          <p className="m-0 max-w-2xl text-muted-foreground">
            {currentUser().organizationName ?? 'This deployment'} has {navCounts.ideas} ideas across{' '}
            {navCounts.boards} boards. Your identity, those counts and the boards below come from
            the API; the delivery and settings surfaces are still reading{' '}
            <code className="font-mono text-xs">lib/mock.ts</code>.
          </p>
        </div>

        {boards.length === 0 ? <NoBoards /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Conversion status</CardTitle>
            <CardDescription>
              Where the TypeScript rewrite actually is — see{' '}
              <code className="font-mono text-xs">SPEC/50-typescript-migration.md</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {WAVES.map((wave) => (
              <div key={wave.id} className="flex items-baseline gap-3">
                <Badge variant={TONE[wave.state]} className="w-16 shrink-0 justify-center">
                  {wave.id.replace('Wave ', '')}
                </Badge>
                <span className="text-sm">{wave.what}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Try the shell</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="m-0">
              Press <b>Ctrl K</b> to open the command palette; arrow keys and Enter navigate.
            </p>
            <p className="m-0">
              The auth screens are outside the desk shell: <Link href="/login">sign in</Link> and{' '}
              <Link href="/change-password">change password</Link>.
            </p>
            <p className="m-0">
              <Link href="/design-system">Design system</Link> renders the theme and every
              primitive.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
