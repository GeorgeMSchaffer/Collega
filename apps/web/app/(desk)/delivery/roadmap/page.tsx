import { Topbar } from '@/components/nav/topbar'
import { NotBuilt } from '@/components/not-built'

export const metadata = { title: 'Roadmap · Collega' }

export default function Page() {
  return (
    <>
      <Topbar title="Roadmap" />
      <main className="p-6">
        <NotBuilt
          title="Roadmap"
          slice="E6"
          owns="roadmap, sprint board, backlog, issue and grouping"
        />
      </main>
    </>
  )
}
