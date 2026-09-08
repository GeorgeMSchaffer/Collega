import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@collega/design-system'
import Link from 'next/link'
import { Topbar } from '@/components/nav/topbar'
import { currentUser, isAdministrator, type Role } from '@/lib/session'

export const metadata = { title: 'Settings · Collega' }

type Section = { href: string; title: string; blurb: string; badge?: string }

/** Every role reaches its own profile, which is why the hub itself is ungated. */
const PROFILE: Section = {
  href: '/settings/profile',
  title: 'My profile',
  blurb: 'Your name, your portrait, and your password.',
}

/**
 * The hub is a role map, not a menu (`SPEC/20-feature-client-ui.md`), so the list is built per role
 * rather than filtered from one array with a flag.
 *
 * Two routes read differently for a Site Admin than a flag could express. **Boards** points at the
 * workspace list instead of `/settings/boards`, because board administration is scoped to one
 * organization and a Site Admin belongs to none — sending them to a settings route with nothing to
 * list would be a dead end the hub can simply not create. **AI Assist** is absent for the same
 * reason and replaced by AI Prompt, which is the deployment-level surface a Site Admin does own.
 */
function sectionsFor(role: Role): Section[] {
  if (!isAdministrator(role)) return [PROFILE]

  if (role === 'SiteAdmin') {
    return [
      PROFILE,
      {
        href: '/settings/organizations',
        title: 'Organizations',
        blurb: 'Every organization on the deployment, and its size.',
        badge: 'Site Admin',
      },
      {
        href: '/settings/users',
        title: 'Users',
        blurb: 'Every account on the deployment. Open an organization to change its membership.',
      },
      {
        href: '/boards',
        title: 'Boards',
        blurb:
          'Boards belong to an organization, so there is no cross-organization view — this is the workspace list.',
      },
      {
        href: '/settings/statuses',
        title: 'Statuses',
        blurb: 'The columns boards group ideas by, per organization.',
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
      {
        href: '/settings/ai-prompt',
        title: 'AI prompt',
        blurb:
          'The instructions every organization’s assistant runs under, and its version history.',
        badge: 'Site Admin',
      },
      {
        href: '/settings/api-usage',
        title: 'API usage',
        blurb: 'Assistant token consumption and estimated cost, per organization.',
      },
    ]
  }

  return [
    PROFILE,
    {
      href: '/settings/users',
      title: 'Users',
      blurb: 'Who is in this organization, and what each of them may do.',
    },
    {
      href: '/settings/boards',
      title: 'Boards',
      blurb: 'The boards you track ideas on, and which statuses become each one’s swimlanes.',
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
    {
      href: '/settings/ai-assist',
      title: 'AI assist',
      blurb: 'What the assistant should treat as on-topic for this organization.',
    },
    {
      href: '/settings/api-usage',
      title: 'API usage',
      blurb: 'Your assistant token consumption and estimated cost for today.',
    },
  ]
}

/**
 * The settings hub.
 *
 * **Ungated, unlike the routes it links to.** Comp Q's `s-settings` carries no role attribute and
 * gives every role the My Profile card, with this note for members: everything else here "is
 * configured by an organization administrator, so it is **absent rather than refused**". The
 * sub-routes are the opposite — they refuse explicitly, because a member arriving at one has asked
 * for something specific. Gating the hub would strand a member with no route to their own profile.
 */
export default function SettingsPage() {
  const admin = isAdministrator(currentUser.role)
  const sections = sectionsFor(currentUser.role)

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-6 p-6">
        <div>
          <h1>Settings</h1>
          <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
            {currentUser.role === 'SiteAdmin'
              ? 'Deployment-wide configuration. Open an organization to change what belongs to it.'
              : admin
                ? `Configuration for ${currentUser.organizationName}.`
                : 'Your own account. Everything else here belongs to an organization administrator.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.href}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link href={section.href}>{section.title}</Link>
                  {section.badge ? <Badge variant="outline">{section.badge}</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{section.blurb}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {admin ? null : (
          <Alert variant="note" className="max-w-prose">
            <span>
              <b>Settings is almost entirely administrative.</b> You see only your own profile here.
              Users, boards, statuses, idea types, fields and the assistant are configured by an
              organization administrator, so they are <b>absent rather than refused</b>.
            </span>
          </Alert>
        )}
      </main>
    </>
  )
}
