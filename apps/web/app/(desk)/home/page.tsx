import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@collega/design-system'
import Link from 'next/link'
import { Topbar } from '@/components/nav/topbar'
import { getNavCounts } from '@/lib/data'
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

export default async function HomePage() {
  const navCounts = await getNavCounts()

  return (
    <>
      <Topbar title="Home" />
      <main className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="mb-1">Good to see you, {currentUser.displayName.split(' ')[0]}.</h2>
          <p className="m-0 max-w-2xl text-muted-foreground">
            {currentUser.organizationName ?? 'This deployment'} has {navCounts.ideas} ideas across{' '}
            {navCounts.boards} boards. The counts and your identity are hard-coded in{' '}
            <code className="font-mono text-xs">lib/mock.ts</code> until Wave D gives this client an
            API to call.
          </p>
        </div>

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
