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
import { AdminOnly } from '@/components/settings/admin-only'
import { currentUser } from '@/lib/mock'

export const metadata = { title: 'Settings · Collega' }

/**
 * The settings hub. `siteAdminOnly` entries are listed for everyone who reaches this page but say
 * so — an Org Admin should know the route exists and why it is not theirs, rather than finding a
 * shorter menu than a colleague's.
 */
type Section = { href: string; title: string; blurb: string; siteAdminOnly?: boolean }

const SECTIONS: Section[] = [
  {
    href: '/settings/organizations',
    title: 'Organizations',
    blurb: 'Every organization on the deployment, and its size.',
    siteAdminOnly: true,
  },
  {
    href: '/settings/users',
    title: 'Users',
    blurb: 'Who is in this organization, and what each of them may do.',
  },
  {
    href: '/settings/statuses',
    title: 'Statuses',
    blurb: 'The columns your boards group ideas by. Order here is the order on every board.',
  },
  {
    href: '/settings/idea-types',
    title: 'Idea types',
    blurb: 'The kinds of idea people may raise, and which fields each one asks for.',
  },
  {
    href: '/settings/fields',
    title: 'Custom fields',
    blurb: 'Extra questions attached to an idea type.',
  },
]

/** Settings surfaces comp Q has that this slice does not build. Named so the gap is visible. */
const NOT_BUILT = ['Boards', 'AI assist', 'API usage', 'CSV import', 'Profile']

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-6 p-6">
        <AdminOnly what="this organization">
          <div>
            <h1>Settings</h1>
            <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
              {currentUser.role === 'SiteAdmin'
                ? 'Deployment-wide configuration. Open an organization to change what belongs to it.'
                : `Configuration for ${currentUser.organizationName}.`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((section) => {
              const closed = section.siteAdminOnly && currentUser.role !== 'SiteAdmin'
              return (
                <Card key={section.href}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {closed ? section.title : <Link href={section.href}>{section.title}</Link>}
                      {section.siteAdminOnly ? <Badge variant="outline">Site Admin</Badge> : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      {closed
                        ? 'Deployment configuration, not this organization’s — closed to your role.'
                        : section.blurb}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Not built yet</h2>
            <div className="flex flex-wrap gap-2">
              {NOT_BUILT.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
            <p className="m-0 mt-2 text-xs text-muted-foreground">
              These settings surfaces exist in comp Q and are not in this slice. They need Wave
              D&rsquo;s API before they can do anything.
            </p>
          </div>
        </AdminOnly>
      </main>
    </>
  )
}
