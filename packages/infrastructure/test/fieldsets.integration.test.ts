// Fieldsets against a live Postgres (SPEC/contracts/fieldsets.md, SPEC/decisions.md 2026-10-04).
// What only a real database can show: the unique pairs and the case-insensitive name index, cascade
// from a fieldset to its members and from an idea type to its attachments, a restrict on deleting
// an attached fieldset, a save that replaces members and attachments without tripping the unique
// pair, the batch loader and usage counts, a value for a fieldset-supplied field being accepted by
// the real resolver and one outside the effective set refused, and the demo reset clearing the new
// tables without a foreign-key error.
//
// Skipped unless `DATABASE_URL` is set. Creates its own organization (and, for the reset case, a
// demo-derived one) and removes everything afterwards, so it needs no seed.

import { randomUUID } from 'node:crypto'
import { ConflictError, ValidationError } from '@collega/application/common'
import { FieldType } from '@collega/domain/enums'
import {
  createFieldset,
  type Fieldset,
  setFieldsetFields,
  updateFieldset,
} from '@collega/domain/fieldsets'
import {
  createIdeaType,
  type IdeaType,
  setIdeaTypeFieldSelection,
  softDeleteIdeaType,
} from '@collega/domain/idea-fields'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetDemoSeed } from '../src/demo-seed/index.js'
import { DEMO_ORGANIZATIONS, seedId } from '../src/demo-seed/modules/scenario.js'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaFieldsetRepository } from '../src/repositories/fieldset.repository.js'
import { PrismaIdeaFieldValuesRepository } from '../src/repositories/idea-field-values.repository.js'
import { PrismaIdeaTypeRepository } from '../src/repositories/idea-type.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-04T08:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Fieldsets against a live database', () => {
  const prisma = new PrismaClient()
  const run = randomUUID().slice(0, 8)
  const organizationIds: string[] = []
  const demoSlug = DEMO_ORGANIZATIONS[0]?.slug ?? ''

  // One unit of work per "request", as in production.
  const repos = () => {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    return {
      unitOfWork,
      fieldsets: new PrismaFieldsetRepository(prisma, unitOfWork),
      ideaTypes: new PrismaIdeaTypeRepository(prisma, unitOfWork),
    }
  }

  async function newOrganization(id: string = randomUUID()): Promise<string> {
    await prisma.organizations.create({
      data: {
        id,
        title: `fieldsets-qa-${run}-${id.slice(0, 4)}`,
        description: 'scratch',
        invite_code: `fq-${run}-${id.slice(0, 8)}`,
        is_archived: false,
        created_at_utc: AT,
        updated_at_utc: AT,
      },
    })
    organizationIds.push(id)
    return id
  }

  async function newField(
    organizationId: string,
    name: string,
    over: { required?: boolean; deleted?: boolean } = {},
  ): Promise<string> {
    const id = randomUUID()
    await prisma.field_definitions.create({
      data: {
        id,
        organization_id: organizationId,
        name,
        normalized_name: name.toLowerCase(),
        field_type: FieldType.Text,
        is_required: over.required ?? false,
        display_order: 10,
        is_deleted: over.deleted ?? false,
        created_at_utc: AT,
        updated_at_utc: AT,
      },
    })
    return id
  }

  function newFieldset(organizationId: string, name: string, members: readonly string[] = []) {
    const created = createFieldset({
      id: randomUUID(),
      organizationId,
      name,
      description: null,
      displayOrder: 10,
      nowUtc: AT,
      actorUserId: null,
    })
    return setFieldsetFields(
      created,
      members.map((fieldDefinitionId, i) => ({
        id: randomUUID(),
        fieldDefinitionId,
        displayOrder: (i + 1) * 10,
      })),
      AT,
      null,
    )
  }

  function newType(organizationId: string, name = 'Type'): IdeaType {
    return createIdeaType({
      id: randomUUID(),
      organizationId,
      name: `${name}-${run}`,
      sortOrder: 10,
      nowUtc: AT,
      actorUserId: null,
    })
  }

  const attach = (type: IdeaType, fieldsetIds: readonly string[]): IdeaType =>
    setIdeaTypeFieldSelection(
      type,
      [],
      AT,
      null,
      fieldsetIds.map((fieldsetId, i) => ({
        id: randomUUID(),
        fieldsetId,
        displayOrder: (i + 1) * 10,
      })),
    )

  async function persistFieldset(fieldset: Fieldset): Promise<void> {
    const { fieldsets, unitOfWork } = repos()
    await fieldsets.add(fieldset)
    await unitOfWork.saveChanges()
  }

  async function persistType(type: IdeaType): Promise<void> {
    const { ideaTypes, unitOfWork } = repos()
    await ideaTypes.add(type)
    await unitOfWork.saveChanges()
  }

  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    const org = { organization_id: { in: organizationIds } }
    await prisma.idea_type_fieldsets.deleteMany({ where: { idea_types: org } })
    await prisma.idea_type_fields.deleteMany({ where: { idea_types: org } })
    await prisma.fieldset_fields.deleteMany({ where: { fieldsets: org } })
    await prisma.fieldsets.deleteMany({ where: org })
    await prisma.field_definitions.deleteMany({ where: org })
    await prisma.idea_types.deleteMany({ where: org })
    await prisma.organizations.deleteMany({ where: { id: { in: organizationIds } } })
    await prisma.$disconnect()
  })

  describe('constraints', () => {
    it('refuses a second fieldset whose name differs only in case, as a ConflictError', async () => {
      const org = await newOrganization()
      await persistFieldset(newFieldset(org, 'Launch Kit'))

      const { fieldsets, unitOfWork } = repos()
      await fieldsets.add(newFieldset(org, 'LAUNCH kit'))

      await expect(unitOfWork.saveChanges()).rejects.toBeInstanceOf(ConflictError)
    })

    it('allows the same name in two organizations', async () => {
      const a = await newOrganization()
      const b = await newOrganization()
      await persistFieldset(newFieldset(a, 'Shared name'))

      await expect(persistFieldset(newFieldset(b, 'Shared name'))).resolves.toBeUndefined()
    })

    it('refuses the same field twice in one fieldset at the database', async () => {
      const org = await newOrganization()
      const field = await newField(org, `dup-${run}`)
      const fieldset = newFieldset(org, 'Dup members')
      await persistFieldset(fieldset)

      await expect(
        prisma.fieldset_fields.createMany({
          data: [
            {
              id: randomUUID(),
              fieldset_id: fieldset.id,
              field_definition_id: field,
              display_order: 1,
            },
            {
              id: randomUUID(),
              fieldset_id: fieldset.id,
              field_definition_id: field,
              display_order: 2,
            },
          ],
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })

    it('refuses the same fieldset attached twice to one idea type at the database', async () => {
      const org = await newOrganization()
      const fieldset = newFieldset(org, 'Attach twice')
      await persistFieldset(fieldset)
      const type = newType(org)
      await persistType(type)

      await expect(
        prisma.idea_type_fieldsets.createMany({
          data: [
            { id: randomUUID(), idea_type_id: type.id, fieldset_id: fieldset.id, display_order: 1 },
            { id: randomUUID(), idea_type_id: type.id, fieldset_id: fieldset.id, display_order: 2 },
          ],
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })
  })

  describe('delete rules', () => {
    it('cascades a deleted fieldset to its members and leaves the field definitions', async () => {
      const org = await newOrganization()
      const field = await newField(org, `kept-${run}`)
      const fieldset = newFieldset(org, 'Cascade', [field])
      await persistFieldset(fieldset)

      const { fieldsets, unitOfWork } = repos()
      await fieldsets.delete(fieldset.id)
      await unitOfWork.saveChanges()

      expect(await prisma.fieldset_fields.count({ where: { fieldset_id: fieldset.id } })).toBe(0)
      expect(await prisma.field_definitions.count({ where: { id: field } })).toBe(1)
    })

    it('refuses deleting a fieldset an idea type still has attached, and keeps both', async () => {
      const org = await newOrganization()
      const fieldset = newFieldset(org, 'Restricted')
      await persistFieldset(fieldset)
      await persistType(attach(newType(org), [fieldset.id]))

      const { fieldsets, unitOfWork } = repos()
      await fieldsets.delete(fieldset.id)

      await expect(unitOfWork.saveChanges()).rejects.toBeDefined()
      expect(await prisma.fieldsets.count({ where: { id: fieldset.id } })).toBe(1)
      expect(await prisma.idea_type_fieldsets.count({ where: { fieldset_id: fieldset.id } })).toBe(
        1,
      )
    })

    it('cascades a deleted idea type to its attachments and leaves the fieldset', async () => {
      const org = await newOrganization()
      const fieldset = newFieldset(org, 'Survives')
      await persistFieldset(fieldset)
      const type = attach(newType(org), [fieldset.id])
      await persistType(type)

      await prisma.idea_types.delete({ where: { id: type.id } })

      expect(await prisma.idea_type_fieldsets.count({ where: { idea_type_id: type.id } })).toBe(0)
      expect(await prisma.fieldsets.count({ where: { id: fieldset.id } })).toBe(1)
    })
  })

  describe('save', () => {
    it('replaces members in one commit: reorders a kept row, drops one, adds one', async () => {
      const org = await newOrganization()
      const [a, b, c] = [
        await newField(org, `a-${run}`),
        await newField(org, `b-${run}`),
        await newField(org, `c-${run}`),
      ] as [string, string, string]
      const original = newFieldset(org, 'Members', [a, b])
      await persistFieldset(original)
      const keptRowId = original.fields.find((f) => f.fieldDefinitionId === b)?.id as string

      const next = setFieldsetFields(
        original,
        [
          { id: keptRowId, fieldDefinitionId: b, displayOrder: 10 },
          { id: randomUUID(), fieldDefinitionId: c, displayOrder: 20 },
        ],
        AT,
        null,
      )
      const { fieldsets, unitOfWork } = repos()
      await fieldsets.save(next)
      await unitOfWork.saveChanges()

      const stored = await repos().fieldsets.getById(original.id)
      expect(stored?.fields.map((f) => [f.fieldDefinitionId, f.displayOrder])).toEqual([
        [b, 10],
        [c, 20],
      ])
      expect(stored?.fields[0]?.id).toBe(keptRowId)
    })

    it('re-adds a removed field under a new row id without hitting the unique pair', async () => {
      const org = await newOrganization()
      const a = await newField(org, `swap-${run}`)
      const original = newFieldset(org, 'Swap', [a])
      await persistFieldset(original)

      const next = setFieldsetFields(
        original,
        [{ id: randomUUID(), fieldDefinitionId: a, displayOrder: 10 }],
        AT,
        null,
      )
      const { fieldsets, unitOfWork } = repos()
      await fieldsets.save(next)

      await expect(unitOfWork.saveChanges()).resolves.toBeUndefined()
      expect(await prisma.fieldset_fields.count({ where: { fieldset_id: original.id } })).toBe(1)
    })

    it('stores a rename with its normalized name', async () => {
      const org = await newOrganization()
      const original = newFieldset(org, 'Before')
      await persistFieldset(original)

      const { fieldsets, unitOfWork } = repos()
      await fieldsets.save(
        updateFieldset(
          original,
          { name: 'After Name', description: 'd', displayOrder: 50 },
          AT,
          null,
        ),
      )
      await unitOfWork.saveChanges()

      const row = await prisma.fieldsets.findUnique({ where: { id: original.id } })
      expect(row).toMatchObject({
        name: 'After Name',
        normalized_name: 'after name',
        display_order: 50,
      })
    })

    it('saves an idea type whose same attachment arrives under a fresh link id', async () => {
      const org = await newOrganization()
      const fieldset = newFieldset(org, 'Same pair')
      await persistFieldset(fieldset)
      const first = attach(newType(org), [fieldset.id])
      await persistType(first)

      // The service builds fresh ids on every save, so the same selection re-saved is a different
      // row id for the same (idea type, fieldset) pair.
      const again = attach(first, [fieldset.id])
      const { ideaTypes, unitOfWork } = repos()
      await ideaTypes.save(again)

      await expect(unitOfWork.saveChanges()).resolves.toBeUndefined()
      const stored = await repos().ideaTypes.getById(first.id)
      expect(stored?.fieldsets.map((l) => l.fieldsetId)).toEqual([fieldset.id])
      expect(stored?.fieldsets[0]?.id).toBe(again.fieldsets[0]?.id)
    })

    it('saves a reordered and reduced attachment list, and clearing it empties the table rows', async () => {
      const org = await newOrganization()
      const [x, y, z] = [
        newFieldset(org, 'X'),
        newFieldset(org, 'Y'),
        newFieldset(org, 'Z'),
      ] as const
      for (const f of [x, y, z]) {
        await persistFieldset(f)
      }
      const type = attach(newType(org), [x.id, y.id, z.id])
      await persistType(type)

      const reordered = attach(type, [z.id, x.id])
      let r = repos()
      await r.ideaTypes.save(reordered)
      await r.unitOfWork.saveChanges()
      const stored = await repos().ideaTypes.getById(type.id)
      expect(stored?.fieldsets.map((l) => l.fieldsetId).sort()).toEqual([x.id, z.id].sort())
      expect(stored?.fieldMode).toBe('Curated')

      r = repos()
      await r.ideaTypes.save(setIdeaTypeFieldSelection(reordered, [], AT, null, []))
      await r.unitOfWork.saveChanges()
      const cleared = await repos().ideaTypes.getById(type.id)
      expect(cleared?.fieldsets).toEqual([])
      expect(cleared?.fieldMode).toBe('AllActiveFields')
    })
  })

  describe('reads', () => {
    it('getManyByIds returns existing fieldsets with members and omits unknown ids', async () => {
      const org = await newOrganization()
      const field = await newField(org, `m-${run}`)
      const one = newFieldset(org, 'One', [field])
      const two = newFieldset(org, 'Two')
      await persistFieldset(one)
      await persistFieldset(two)

      const { fieldsets } = repos()
      const found = await fieldsets.getManyByIds([one.id, two.id, randomUUID()])

      expect(found.map((f) => f.id).sort()).toEqual([one.id, two.id].sort())
      expect(found.find((f) => f.id === one.id)?.fields).toHaveLength(1)
      await expect(fieldsets.getManyByIds([])).resolves.toEqual([])
    })

    it('getUsage counts active and archived attachments separately and includes unused ids', async () => {
      const org = await newOrganization()
      const used = newFieldset(org, 'Used')
      const unused = newFieldset(org, 'Unused')
      await persistFieldset(used)
      await persistFieldset(unused)
      await persistType(attach(newType(org, 'live-1'), [used.id]))
      await persistType(attach(newType(org, 'live-2'), [used.id]))
      await persistType(softDeleteIdeaType(attach(newType(org, 'gone'), [used.id]), AT, null))

      const usage = await repos().fieldsets.getUsage([used.id, unused.id])

      expect(usage.get(used.id)).toEqual({ active: 2, total: 3 })
      expect(usage.get(unused.id)).toEqual({ active: 0, total: 0 })
    })

    it('existsByName matches case-insensitively within the organization and honours the exclusion', async () => {
      const org = await newOrganization()
      const other = await newOrganization()
      const fieldset = newFieldset(org, 'Mixed Case')
      await persistFieldset(fieldset)
      const { fieldsets } = repos()

      expect(await fieldsets.existsByName(org, 'mixed CASE', null)).toBe(true)
      expect(await fieldsets.existsByName(org, 'mixed case', fieldset.id)).toBe(false)
      expect(await fieldsets.existsByName(other, 'mixed case', null)).toBe(false)
    })
  })

  describe('field values through the real resolver', () => {
    it('accepts a value for a fieldset-supplied field and refuses one outside the effective set', async () => {
      const org = await newOrganization()
      const supplied = await newField(org, `supplied-${run}`)
      const outside = await newField(org, `outside-${run}`)
      const fieldset = newFieldset(org, 'Supplier', [supplied])
      await persistFieldset(fieldset)
      const type = attach(newType(org), [fieldset.id])
      await persistType(type)
      const values = new PrismaIdeaFieldValuesRepository(prisma)

      await expect(
        values.resolveAndValidate({
          organizationId: org,
          ideaTypeId: type.id,
          submitted: [{ fieldDefinitionId: supplied, value: 'hello' }],
        }),
      ).resolves.toEqual([{ fieldDefinitionId: supplied, value: 'hello' }])
      await expect(
        values.resolveAndValidate({
          organizationId: org,
          ideaTypeId: type.id,
          submitted: [{ fieldDefinitionId: outside, value: 'nope' }],
        }),
      ).rejects.toBeInstanceOf(ValidationError)
      expect(await values.getReconcileScope(org, type.id)).toEqual([supplied])
    })

    it('requires a fieldset-supplied field by its global flag and skips an archived member', async () => {
      const org = await newOrganization()
      const mandatory = await newField(org, `mandatory-${run}`, { required: true })
      const archived = await newField(org, `archived-${run}`, { required: true, deleted: true })
      const fieldset = newFieldset(org, 'Required set', [mandatory, archived])
      await persistFieldset(fieldset)
      const type = attach(newType(org), [fieldset.id])
      await persistType(type)
      const values = new PrismaIdeaFieldValuesRepository(prisma)

      const error = await values
        .resolveAndValidate({ organizationId: org, ideaTypeId: type.id, submitted: [] })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ValidationError)
      expect(Object.keys((error as ValidationError).failures)).toEqual([`mandatory-${run}`])
    })

    it('does not resolve a fieldset belonging to another organization', async () => {
      const org = await newOrganization()
      const other = await newOrganization()
      const foreignField = await newField(other, `foreign-${run}`)
      const foreignSet = newFieldset(other, 'Foreign', [foreignField])
      await persistFieldset(foreignSet)
      // An attachment row naming a fieldset outside the type's organization (the service refuses to
      // create one; the resolver must still not surface its fields).
      const type = newType(org)
      await persistType(type)
      await prisma.idea_type_fieldsets.create({
        data: {
          id: randomUUID(),
          idea_type_id: type.id,
          fieldset_id: foreignSet.id,
          display_order: 10,
        },
      })
      await prisma.idea_types.update({ where: { id: type.id }, data: { field_mode: 'Curated' } })
      const values = new PrismaIdeaFieldValuesRepository(prisma)

      expect(await values.getReconcileScope(org, type.id)).toEqual([])
    })
  })

  describe('demo reset', () => {
    it('deletes fieldsets, members and attachments under a demo organization without a foreign-key error', async () => {
      const demoOrg = seedId('organization', demoSlug)
      await prisma.organizations.deleteMany({ where: { id: demoOrg } })
      await newOrganization(demoOrg)
      const field = await newField(demoOrg, `demo-${run}`)
      const fieldset = newFieldset(demoOrg, 'Demo set', [field])
      await persistFieldset(fieldset)
      const type = attach(newType(demoOrg), [fieldset.id])
      await persistType(type)

      await expect(resetDemoSeed(prisma)).resolves.toBeGreaterThan(0)

      expect(await prisma.fieldsets.count({ where: { organization_id: demoOrg } })).toBe(0)
      expect(await prisma.fieldset_fields.count({ where: { fieldset_id: fieldset.id } })).toBe(0)
      expect(await prisma.idea_type_fieldsets.count({ where: { idea_type_id: type.id } })).toBe(0)
      expect(await prisma.organizations.count({ where: { id: demoOrg } })).toBe(0)
    })
  })
})
