// markCreated/markUpdated are the TS replacement for the .NET AuditableEntityBase's
// protected MarkCreated/MarkUpdated (src/Collega.Domain/Common/AuditableEntityBase.cs).
// Two behaviours of the original are easy to lose in the immutable-function rewrite and
// both are replay-diff sensitive against the golden corpus, so they get dedicated tests
// rather than folding into a single "happy path" case:
//   - MarkCreated set CreatedAtUtc and UpdatedAtUtc from the SAME DateTime read, so a
//     created row always has the two columns equal to the instant, not merely close.
//   - MarkUpdated touched only UpdatedAtUtc/UpdatedByUserId and left the created fields
//     alone - a test that only checked the two changed fields would pass against an
//     implementation that quietly dropped every other field on the entity.

import { describe, expect, it } from 'vitest'
import { type Auditable, markCreated, markUpdated } from '../src/common/index.js'

/** A stand-in Wave B entity: the Auditable fields plus one field that has nothing to do
 * with auditing, to prove markUpdated's spread carries the rest of the entity through. */
type FakeEntity = Auditable & { readonly name: string }

describe('markCreated', () => {
  it('stamps createdAtUtc and updatedAtUtc to the exact same instant', () => {
    const nowUtc = new Date('2026-01-01T00:00:00.000Z')

    const result = markCreated(nowUtc, 'user-1')

    // getTime() equality, not toBeCloseTo/a tolerance window: the .NET original assigned
    // both columns from one DateTime read, and the golden corpus records them equal, not
    // merely near each other.
    expect(result.createdAtUtc.getTime()).toBe(nowUtc.getTime())
    expect(result.updatedAtUtc.getTime()).toBe(nowUtc.getTime())
  })

  it('stamps both created/updated actor fields to the given actor', () => {
    const result = markCreated(new Date(), 'user-1')

    expect(result.createdByUserId).toBe('user-1')
    expect(result.updatedByUserId).toBe('user-1')
  })

  it('preserves a null actor rather than coercing it to undefined', () => {
    // Background/system-originated writes have no human actor, and the audit_events
    // columns are nullable - `null` is the legitimate value here, not an absent one.
    const result = markCreated(new Date(), null)

    expect(result.createdByUserId).toBeNull()
    expect(result.updatedByUserId).toBeNull()
  })
})

describe('markUpdated', () => {
  function existingEntity(): FakeEntity {
    return {
      createdAtUtc: new Date('2026-01-01T00:00:00.000Z'),
      updatedAtUtc: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: 'creator-1',
      updatedByUserId: 'creator-1',
      name: 'original name',
    }
  }

  it('changes updatedAtUtc and updatedByUserId to the given instant and actor', () => {
    const nowUtc = new Date('2026-06-01T12:00:00.000Z')

    const result = markUpdated(existingEntity(), nowUtc, 'editor-2')

    expect(result.updatedAtUtc.getTime()).toBe(nowUtc.getTime())
    expect(result.updatedByUserId).toBe('editor-2')
  })

  it('leaves createdAtUtc and createdByUserId untouched', () => {
    const entity = existingEntity()

    const result = markUpdated(entity, new Date('2026-06-01T12:00:00.000Z'), 'editor-2')

    expect(result.createdAtUtc.getTime()).toBe(entity.createdAtUtc.getTime())
    expect(result.createdByUserId).toBe(entity.createdByUserId)
  })

  it('carries every other field on the entity through unchanged', () => {
    // The property a naive `{ ...entity, updatedAtUtc, updatedByUserId }` could still get
    // wrong: an implementation that rebuilds the object field-by-field instead of spreading
    // would silently drop `name`, and only this assertion would catch it.
    const entity = existingEntity()

    const result = markUpdated(entity, new Date(), 'editor-2')

    expect(result.name).toBe('original name')
  })

  it('does not mutate the entity passed in', () => {
    const entity = existingEntity()
    const originalUpdatedAtUtc = entity.updatedAtUtc
    const originalUpdatedByUserId = entity.updatedByUserId

    const result = markUpdated(entity, new Date('2026-06-01T12:00:00.000Z'), 'editor-2')

    expect(entity.updatedAtUtc).toBe(originalUpdatedAtUtc)
    expect(entity.updatedByUserId).toBe(originalUpdatedByUserId)
    expect(result).not.toBe(entity)
  })

  it('preserves a null actor rather than coercing it to undefined', () => {
    const result = markUpdated(existingEntity(), new Date(), null)

    expect(result.updatedByUserId).toBeNull()
  })
})
