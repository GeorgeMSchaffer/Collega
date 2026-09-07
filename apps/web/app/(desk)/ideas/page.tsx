import { Topbar } from '@/components/nav/topbar'
import { NotBuilt } from '@/components/not-built'

export const metadata = { title: 'Ideas · Collega' }

export default function Page() {
  return (
    <>
      <Topbar title="Ideas" />
      <main className="p-6">
        <NotBuilt title="Ideas" slice="E3" owns="the ideas list and the board lanes" />
      </main>
    </>
  )
}
