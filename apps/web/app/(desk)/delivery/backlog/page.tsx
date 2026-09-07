import { Topbar } from '@/components/nav/topbar'
import { NotBuilt } from '@/components/not-built'

export const metadata = { title: 'Backlog · Collega' }

export default function Page() {
  return (
    <>
      <Topbar title="Backlog" />
      <main className="p-6">
        <NotBuilt
          title="Backlog"
          slice="E6"
          owns="roadmap, sprint board, backlog, issue and grouping"
        />
      </main>
    </>
  )
}
