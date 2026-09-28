import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  type ListConfig,
  type ListState,
  listStateToQuery,
  readListState,
} from '@/components/list/list-state'

/**
 * The list state's round trip through the URL (`SPEC/20-feature-client-ui.md`, "List and detail
 * pattern"): a shared link must reopen the same list, and a bare path must be the default list.
 */
const BOARDS: ListConfig = {
  filters: ['status'],
  filterDefaults: { status: ['Active'] },
  views: ['list', 'cards'],
  sortKeys: ['name', 'ideas'],
}

const IDEAS: ListConfig = {
  filters: ['board', 'status', 'priority', 'tag'],
  views: ['list', 'cards'],
  sortKeys: ['title', 'priority'],
}

const read = (query: string, config: ListConfig) =>
  readListState(new URLSearchParams(query), config)

describe('readListState', () => {
  it('reads a bare path as the default list, with filter defaults applied', () => {
    expect(read('', BOARDS)).toEqual({
      q: '',
      filters: { status: ['Active'] },
      sort: null,
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      view: 'list',
    })
  })

  it('reads a present-but-empty filter as cleared on purpose, not as the default', () => {
    expect(read('status=', BOARDS).filters.status).toEqual([])
  })

  it('reads a repeated parameter as every value, in order', () => {
    expect(read('tag=ops&tag=safety&status=s1', IDEAS).filters).toEqual({
      board: [],
      status: ['s1'],
      priority: [],
      tag: ['ops', 'safety'],
    })
  })

  it('ignores a sort key the screen does not offer', () => {
    expect(read('sort=secret&dir=desc', IDEAS).sort).toBeNull()
  })

  it('treats any direction but desc as ascending', () => {
    expect(read('sort=title&dir=sideways', IDEAS).sort).toEqual({ key: 'title', dir: 'asc' })
  })

  it.each([
    ['0', 1],
    ['-3', 1],
    ['abc', 1],
    ['4', 4],
  ])('reads page=%s as page %i', (page, expected) => {
    expect(read(`page=${page}`, IDEAS).page).toBe(expected)
  })

  it('falls back to the default page size for one not on offer', () => {
    expect(read('size=7', IDEAS).size).toBe(DEFAULT_PAGE_SIZE)
    expect(read('size=50', IDEAS).size).toBe(50)
  })

  it('falls back to the first view for one the screen does not offer', () => {
    expect(read('view=lanes', IDEAS).view).toBe('list')
    expect(read('view=cards', IDEAS).view).toBe('cards')
  })

  it('reads a server page’s searchParams record the same as URLSearchParams', () => {
    const record = { q: 'pump', tag: ['a', 'b'], sort: 'priority', dir: 'desc', page: '2' }
    expect(readListState(record, IDEAS)).toEqual(
      read('q=pump&tag=a&tag=b&sort=priority&dir=desc&page=2', IDEAS),
    )
  })
})

describe('listStateToQuery', () => {
  it('writes nothing for the default state', () => {
    expect(listStateToQuery(read('', BOARDS), BOARDS)).toBe('')
  })

  it('writes a cleared defaulted filter as present and empty, so it reads back cleared', () => {
    const state: ListState = { ...read('', BOARDS), filters: { status: [] } }
    const query = listStateToQuery(state, BOARDS)
    expect(query).toBe('status=')
    expect(read(query, BOARDS).filters.status).toEqual([])
  })

  it('omits a filter equal to its default in any order', () => {
    const config: ListConfig = { filters: ['status'], filterDefaults: { status: ['A', 'B'] } }
    const state: ListState = { ...read('', config), filters: { status: ['B', 'A'] } }
    expect(listStateToQuery(state, config)).toBe('')
  })

  it('round-trips a fully specified state', () => {
    const state: ListState = {
      q: 'conveyor belt',
      filters: { board: ['b1', 'b2'], status: [], priority: ['High'], tag: ['a&b'] },
      sort: { key: 'priority', dir: 'desc' },
      page: 3,
      size: 25,
      view: 'cards',
    }
    expect(read(listStateToQuery(state, IDEAS), IDEAS)).toEqual(state)
  })

  it('leaves ascending direction and page 1 out of the URL', () => {
    const state: ListState = { ...read('', IDEAS), sort: { key: 'title', dir: 'asc' } }
    expect(listStateToQuery(state, IDEAS)).toBe('sort=title')
  })
})
