import { navCounts } from '@/lib/mock'

/**
 * The sidebar's contents, in comp P's three groups.
 *
 * `slice` names the Wave E slice that builds the destination. Anything still unbuilt routes to the
 * shared placeholder rather than 404ing or being hidden — a nav that quietly omits half the product
 * misrepresents it, and a 404 reads as a bug rather than as work not yet done.
 */
export type NavItem = {
  href: string
  label: string
  icon: 'home' | 'boards' | 'ideas' | 'sprint' | 'backlog' | 'roadmap' | 'settings'
  count?: number
  slice?: string
}

export type NavGroup = { label: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/home', label: 'Home', icon: 'home' },
      { href: '/boards', label: 'Boards', icon: 'boards', count: navCounts.boards, slice: 'E3' },
      { href: '/ideas', label: 'Ideas', icon: 'ideas', count: navCounts.ideas, slice: 'E3' },
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
        count: navCounts.backlog,
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

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items)
