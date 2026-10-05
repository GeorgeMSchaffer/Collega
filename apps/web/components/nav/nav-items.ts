/**
 * The sidebar's contents, in comp P's three groups.
 *
 * `slice` names the Wave E slice that builds the destination. Anything still unbuilt routes to the
 * shared placeholder rather than 404ing or being hidden — a nav that quietly omits half the product
 * misrepresents it, and a 404 reads as a bug rather than as work not yet done.
 *
 * The counts are **supplied by the caller**, not read here. They are data, and data is fetched per
 * request from `lib/data/`; a module-level read would freeze them at import and would tie this
 * module to a fixture that Wave D deletes. What stays here is the shape.
 */
import { hasInbox, hasOrgWorkspace, type Role } from '@/lib/roles'

export type NavItem = {
  href: string
  label: string
  icon: 'home' | 'inbox' | 'boards' | 'ideas' | 'sprint' | 'backlog' | 'roadmap' | 'settings'
  count?: number
  slice?: string
}

export type NavGroup = { label: string; items: NavItem[] }

export const INBOX_HREF = '/inbox'

/** Organization content: a Site Admin acting as themselves reaches it only through View As. */
const ORG_WORKSPACE = new Set([
  '/boards',
  '/ideas',
  '/delivery/sprint',
  '/delivery/backlog',
  '/delivery/roadmap',
])

/**
 * Whether the sidebar and the palette offer `item` to `role`. A Site Admin acting as themselves has
 * no inbox and no organization workspace, so they see Home and Settings only.
 */
export function navItemVisible(item: NavItem, role: Role): boolean {
  if (item.href === INBOX_HREF) return hasInbox(role)
  if (ORG_WORKSPACE.has(item.href)) return hasOrgWorkspace(role)
  return true
}

export type NavCounts = { boards: number; ideas: number; backlog: number }

/** `countKey` names the figure a caller fills in; everything else is static. */
type NavShapeItem = Omit<NavItem, 'count'> & { countKey?: keyof NavCounts }

const NAV_SHAPE: { label: string; items: NavShapeItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/home', label: 'Home', icon: 'home' },
      // Its unread badge is live rather than a count from here: `inbox-link.tsx`.
      { href: INBOX_HREF, label: 'Inbox', icon: 'inbox' },
      { href: '/boards', label: 'Boards', icon: 'boards', countKey: 'boards' },
      { href: '/ideas', label: 'Ideas', icon: 'ideas', countKey: 'ideas' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { href: '/delivery/sprint', label: 'Sprint board', icon: 'sprint', slice: 'E6' },
      {
        href: '/delivery/backlog',
        label: 'Backlog',
        icon: 'backlog',
        countKey: 'backlog',
        slice: 'E6',
      },
      { href: '/delivery/roadmap', label: 'Roadmap', icon: 'roadmap', slice: 'E6' },
    ],
  },
  {
    label: 'Configure',
    items: [{ href: '/settings', label: 'Settings', icon: 'settings', slice: 'E5' }],
  },
]

function toNavItem({ countKey, ...item }: NavShapeItem, counts?: NavCounts): NavItem {
  return countKey && counts ? { ...item, count: counts[countKey] } : item
}

export function navGroupsWith(counts: NavCounts): NavGroup[] {
  return NAV_SHAPE.map((group) => ({
    label: group.label,
    items: group.items.map((item) => toNavItem(item, counts)),
  }))
}

/**
 * The nav before its counts arrive.
 *
 * Every label, icon and href is static, so the sidebar is fully usable while the counts are still
 * in flight — which is why the layout's Suspense fallback renders this rather than a skeleton. A
 * count appearing a moment later is a smaller lie than a nav that is not there yet.
 */
export const navGroupsWithoutCounts: NavGroup[] = NAV_SHAPE.map((group) => ({
  label: group.label,
  items: group.items.map((item) => toNavItem(item)),
}))

/** The command palette jumps by label, so it takes the shape without any counts. */
export const allNavItems: NavItem[] = NAV_SHAPE.flatMap((group) =>
  group.items.map((item) => toNavItem(item)),
)
