import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getReferenceContext } from '@/lib/data/boards'
import { actAs } from './support/acting-role'

/**
 * What the lane editor's References selector is offered (`contracts/boards.md`): the organization's
 * active boards other than the one being edited, each flagged when it has a reference lane, and
 * the boards that reference this one. The API client is the boundary.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

const get = vi.mocked(apiGet)

type Lane = { referencesBoardId: string | null }
const listed = (id: string, name: string, keyPrefix: string | null = null) => ({
  boardId: id,
  name,
  keyPrefix,
  laneCounts: [
    { order: 1, statusName: 'Second', ideaCount: 0 },
    { order: 0, statusName: 'First', ideaCount: 0 },
  ],
})

function serve(details: Record<string, Lane[]>, list: ReturnType<typeof listed>[]) {
  get.mockImplementation((async (_reader: string, path: string) => {
    if (path.includes('/organizations/')) return list
    const id = decodeURIComponent(path.split('/boards/')[1] ?? '')
    return { swimlanes: details[id] ?? [] }
  }) as unknown as typeof apiGet)
}

beforeEach(() => {
  get.mockReset()
  actAs('OrgAdmin')
})

describe('getReferenceContext', () => {
  it('asks for the active boards only: the list read does not include archived ones', async () => {
    serve({}, [listed('b-1', 'One')])
    await getReferenceContext('b-0')
    const listPath = get.mock.calls
      .map((call) => String(call[1]))
      .find((p) => p.includes('/organizations/'))
    expect(listPath).toBeDefined()
    expect(listPath).not.toMatch(/includeArchived/)
  })

  it('leaves the board being edited out of the choices', async () => {
    serve({}, [listed('b-1', 'One'), listed('b-2', 'Two')])
    const context = await getReferenceContext('b-1')
    expect(context.choices.map((choice) => choice.id)).toEqual(['b-2'])
  })

  it('offers every board when creating, and nothing references a board not yet made', async () => {
    serve({ 'b-1': [{ referencesBoardId: 'b-2' }] }, [listed('b-1', 'One'), listed('b-2', 'Two')])
    const context = await getReferenceContext(null)
    expect(context.choices).toHaveLength(2)
    expect(context.referencedBy).toEqual([])
  })

  it('marks a board with a reference lane, names its prefix and its first lane by order', async () => {
    serve({ 'b-1': [{ referencesBoardId: null }], 'b-2': [{ referencesBoardId: 'b-9' }] }, [
      listed('b-1', 'One', 'ONE'),
      listed('b-2', 'Two'),
    ])
    const { choices } = await getReferenceContext('b-0')
    expect(choices).toEqual([
      { id: 'b-1', name: 'One', keyPrefix: 'ONE', firstLaneName: 'First', hasReferenceLane: false },
      { id: 'b-2', name: 'Two', keyPrefix: null, firstLaneName: 'First', hasReferenceLane: true },
    ])
  })

  it('lists the boards whose lanes reference this one', async () => {
    serve(
      {
        'b-1': [{ referencesBoardId: 'b-0' }, { referencesBoardId: null }],
        'b-2': [{ referencesBoardId: 'b-other' }],
      },
      [listed('b-1', 'One'), listed('b-2', 'Two')],
    )
    const { referencedBy } = await getReferenceContext('b-0')
    expect(referencedBy).toEqual([{ id: 'b-1', name: 'One' }])
  })

  it('answers empty, with no request, for an account that belongs to no organization', async () => {
    actAs('SiteAdmin')
    expect(await getReferenceContext('b-0')).toEqual({ choices: [], referencedBy: [] })
    expect(get).not.toHaveBeenCalled()
  })
})
