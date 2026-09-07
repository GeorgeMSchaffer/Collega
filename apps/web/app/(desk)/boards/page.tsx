import { Topbar } from '@/components/nav/topbar'
import { NotBuilt } from '@/components/not-built'

export const metadata = { title: 'Boards · Collega' }

export default function Page() {
  return (
    <>
      <Topbar title="Boards" />
      <main className="p-6">
        <NotBuilt title="Boards" slice="E3" owns="the ideas list and the board lanes" />
      </main>
    </>
  )
}
