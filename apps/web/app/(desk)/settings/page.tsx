import { Topbar } from '@/components/nav/topbar'
import { NotBuilt } from '@/components/not-built'

export const metadata = { title: 'Settings · Collega' }

export default function Page() {
  return (
    <>
      <Topbar title="Settings" />
      <main className="p-6">
        <NotBuilt
          title="Settings"
          slice="E5"
          owns="organizations, users, statuses, idea types and fields"
        />
      </main>
    </>
  )
}
