import { Topbar } from '@/components/nav/topbar'
import { NotBuilt } from '@/components/not-built'

export const metadata = { title: 'Sprint board · Collega' }

export default function Page() {
  return (
    <>
      <Topbar title="Sprint board" />
      <main className="p-6">
        <NotBuilt
          title="Sprint board"
          slice="E6"
          owns="roadmap, sprint board, backlog, issue and grouping"
        />
      </main>
    </>
  )
}
