import { describe, expect, it, vi } from 'vitest'
import {
  BATCH_SIZE,
  createUsageQueue,
  MAX_QUEUED,
  pathTemplate,
  REPEAT_WINDOW_MS,
  type UsageEvent,
} from '@/lib/usage-queue'

/** The browser's usage queue (`SPEC/20-feature-analytics.md` rules 7, 9 and 13). */
const BOARD = '6f1c2a0e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'

function setup(path = `/boards/${BOARD}`) {
  let clock = 1_700_000_000_000
  const sent: UsageEvent[][] = []
  const queue = createUsageQueue({
    send: (events) => sent.push(events),
    pathname: () => path,
    now: () => clock,
  })
  return { queue, sent, advance: (ms: number) => (clock += ms) }
}

describe('pathTemplate', () => {
  it('replaces every id with [id] and keeps the other segments', () => {
    expect(pathTemplate(`/boards/${BOARD}/sprints/${BOARD.toUpperCase()}`)).toBe(
      '/boards/[id]/sprints/[id]',
    )
    expect(pathTemplate('/settings/ai-assist')).toBe('/settings/ai-assist')
  })
})

describe('createUsageQueue', () => {
  it('records the route template, never the resolved path', () => {
    const { queue, sent } = setup()
    queue.setSending(true)
    queue.record({ type: 'board.viewed', entityId: BOARD })
    queue.flush()
    expect(sent).toEqual([
      [
        {
          type: 'board.viewed',
          route: '/boards/[id]',
          entityId: BOARD,
          props: null,
          occurredAtUtc: new Date(1_700_000_000_000).toISOString(),
        },
      ],
    ])
  })

  it('collapses the same event for the same item within 30 seconds', () => {
    const { queue, advance } = setup()
    queue.record({ type: 'board.viewed', entityId: BOARD })
    advance(REPEAT_WINDOW_MS - 1)
    queue.record({ type: 'board.viewed', entityId: BOARD })
    queue.record({ type: 'list.viewed', props: { list: 'ideas' } })
    expect(queue.size()).toBe(2)
    advance(1)
    queue.record({ type: 'board.viewed', entityId: BOARD })
    expect(queue.size()).toBe(3)
  })

  it('sends at 25 queued events, in batches of at most 25', () => {
    const { queue, sent } = setup()
    queue.setSending(true)
    for (let i = 0; i < BATCH_SIZE - 1; i++) {
      queue.record({ type: 'list.viewed', props: { list: `l${i}` } })
    }
    expect(sent).toHaveLength(0)
    queue.record({ type: 'list.viewed', props: { list: 'last' } })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toHaveLength(BATCH_SIZE)
    expect(queue.size()).toBe(0)
  })

  it('holds events while not sending and keeps only the newest 200', () => {
    const { queue, sent } = setup()
    for (let i = 0; i < MAX_QUEUED + 5; i++) {
      queue.record({ type: 'list.viewed', props: { list: `l${i}` } })
    }
    queue.flush()
    expect(sent).toHaveLength(0)
    expect(queue.size()).toBe(MAX_QUEUED)
    queue.setSending(true)
    queue.flush()
    expect(sent.flat()[0]?.props).toEqual({ list: 'l5' })
    expect(sent.every((batch) => batch.length <= BATCH_SIZE)).toBe(true)
  })

  it('drops a batch whose send throws, and keeps going', () => {
    const send = vi.fn().mockImplementation(() => {
      throw new Error('offline')
    })
    const queue = createUsageQueue({ send, pathname: () => '/ideas' })
    queue.setSending(true)
    queue.record({ type: 'list.viewed', props: { list: 'ideas' } })
    expect(() => queue.flush()).not.toThrow()
    expect(queue.size()).toBe(0)
  })

  it('clear drops what is held without sending it', () => {
    const { queue, sent } = setup()
    queue.record({ type: 'list.viewed', props: { list: 'ideas' } })
    queue.clear()
    queue.setSending(true)
    queue.flush()
    expect(sent).toHaveLength(0)
  })
})
