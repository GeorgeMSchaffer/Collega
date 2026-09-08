import { getNavCounts } from '@/lib/data'
import { navGroupsWith } from './nav-items'
import { SidebarNav } from './sidebar-nav'

/**
 * The desk sidebar.
 *
 * Split in two so the counts can be fetched: they are per-request data, but the rendering needs
 * `usePathname` and so has to be a client component, which cannot await. This half is the Server
 * Component that reads them and hands them down. `app/(desk)/layout.tsx` still renders `<Sidebar />`
 * with no props.
 */
export async function Sidebar() {
  const counts = await getNavCounts()

  return <SidebarNav groups={navGroupsWith(counts)} />
}
