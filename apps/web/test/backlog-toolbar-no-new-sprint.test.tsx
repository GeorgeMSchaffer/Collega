import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BacklogList } from '@/components/boards/backlog-list'
import { TASKS } from './support/backlog-fixtures'

/** TB-5: "+ New sprint" lives on the Sprints tab; the Backlog toolbar carries no such control. */
describe('Backlog toolbar', () => {
  it('has no "+ New sprint…" control, for an admin with nothing selected', () => {
    render(
      <BacklogList
        boardId="b-1"
        boardName="Implementation"
        rows={TASKS}
        total={TASKS.length}
        lanes={[{ id: 'l-1', name: 'To do', color: '#111111', isFinal: false }]}
        canSelect
        newTaskHref={null}
        sprints={[]}
        members={[]}
      />,
    )
    expect(screen.queryByRole('button', { name: /New sprint/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /New sprint/ })).toBeNull()
  })
})
