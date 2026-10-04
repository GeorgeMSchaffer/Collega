import { DEFAULT_IDEA_TYPES } from '@collega/application/organizations'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SeedModule } from '../types.js'
import { DEMO_ORGANIZATIONS, IDEA_SCENARIOS, seedId } from './scenario.js'

/**
 * Custom fields, fieldsets, which idea types use them, and a few values on the first board's
 * ideas (`SPEC/decisions.md` 2026-10-04 "Fieldsets").
 *
 * Organizations without a `fieldConfig` get nothing. A type with a `typeFields` entry becomes
 * `Curated`; every other type stays on all active fields, which is the contrast the idea-type
 * picker and the idea form are meant to show.
 */
export const fieldsSeed: SeedModule = {
  name: 'fields',
  dependsOn: ['organizations', 'ideas-and-upvotes'],

  async seed(prisma: PrismaClient): Promise<void> {
    const now = new Date()

    for (const scenario of DEMO_ORGANIZATIONS) {
      const config = scenario.fieldConfig
      if (config === undefined) continue

      const organizationId = seedId('organization', scenario.slug)
      const fieldId = (name: string) => seedId('field', scenario.slug, name)
      const optionId = (field: string, label: string) =>
        seedId('field-option', scenario.slug, field, label)
      const fieldsetId = (name: string) => seedId('fieldset', scenario.slug, name)
      const typeId = (name: string) => seedId('idea-type', scenario.slug, name)

      const fieldNames = new Set(config.fields.map((field) => field.name))
      const fieldsetNames = new Set(config.fieldsets.map((fieldset) => fieldset.name))
      const requireKnown = (kind: string, names: ReadonlySet<string>, name: string) => {
        if (!names.has(name)) {
          throw new Error(
            `'${scenario.slug}' references ${kind} '${name}', which it does not define.`,
          )
        }
      }

      for (const [order, field] of config.fields.entries()) {
        await prisma.field_definitions.upsert({
          where: { id: fieldId(field.name) },
          update: {},
          create: {
            id: fieldId(field.name),
            organization_id: organizationId,
            name: field.name,
            normalized_name: field.name.trim().toLowerCase(),
            description: field.description ?? null,
            field_type: field.type,
            is_required: false,
            display_order: order + 1,
            is_deleted: false,
            created_at_utc: now,
            updated_at_utc: now,
          },
        })
        for (const [optionOrder, label] of (field.options ?? []).entries()) {
          await prisma.field_definition_options.upsert({
            where: { id: optionId(field.name, label) },
            update: {},
            create: {
              id: optionId(field.name, label),
              field_definition_id: fieldId(field.name),
              label,
              display_order: optionOrder + 1,
            },
          })
        }
      }

      for (const [order, fieldset] of config.fieldsets.entries()) {
        await prisma.fieldsets.upsert({
          where: { id: fieldsetId(fieldset.name) },
          update: {},
          create: {
            id: fieldsetId(fieldset.name),
            organization_id: organizationId,
            name: fieldset.name,
            normalized_name: fieldset.name.trim().toLowerCase(),
            description: fieldset.description,
            display_order: order + 1,
            created_at_utc: now,
            updated_at_utc: now,
          },
        })
        for (const [memberOrder, name] of fieldset.fields.entries()) {
          requireKnown('field', fieldNames, name)
          const memberId = seedId('fieldset-field', scenario.slug, fieldset.name, name)
          await prisma.fieldset_fields.upsert({
            where: { id: memberId },
            update: {},
            create: {
              id: memberId,
              fieldset_id: fieldsetId(fieldset.name),
              field_definition_id: fieldId(name),
              display_order: memberOrder + 1,
            },
          })
        }
      }

      // Effective field names per curated idea type, to check the seeded values against below.
      const effectiveByType = new Map<string, Set<string>>()

      for (const attachment of config.typeFields) {
        const effective = new Set<string>()
        effectiveByType.set(attachment.ideaType, effective)

        // Restored every run, like the names in the organizations module.
        await prisma.idea_types.update({
          where: { id: typeId(attachment.ideaType) },
          data: { field_mode: 'Curated' },
        })

        for (const [order, field] of attachment.fields.entries()) {
          requireKnown('field', fieldNames, field.name)
          effective.add(field.name)
          const id = seedId('idea-type-field', scenario.slug, attachment.ideaType, field.name)
          await prisma.idea_type_fields.upsert({
            where: { id },
            update: {},
            create: {
              id,
              idea_type_id: typeId(attachment.ideaType),
              field_definition_id: fieldId(field.name),
              display_order: order + 1,
              is_required: field.required,
            },
          })
        }
        for (const [order, name] of attachment.fieldsets.entries()) {
          requireKnown('fieldset', fieldsetNames, name)
          for (const member of config.fieldsets.find((f) => f.name === name)?.fields ?? []) {
            effective.add(member)
          }
          const id = seedId('idea-type-fieldset', scenario.slug, attachment.ideaType, name)
          await prisma.idea_type_fieldsets.upsert({
            where: { id },
            update: {},
            create: {
              id,
              idea_type_id: typeId(attachment.ideaType),
              fieldset_id: fieldsetId(name),
              display_order: order + 1,
            },
          })
        }
      }

      const board = scenario.boards[0]
      if (board === undefined) continue
      const optionsByField = new Map(config.fields.map((f) => [f.name, f.options ?? []] as const))

      for (const entry of config.fieldValues) {
        const ideaTitle = (board.ideas ?? IDEA_SCENARIOS)[entry.ideaIndex]?.title
        if (ideaTitle === undefined) {
          throw new Error(`'${scenario.slug}' has no idea ${entry.ideaIndex} to put values on.`)
        }
        const ideaId = seedId('idea', scenario.slug, board.name, ideaTitle)
        const ideaTypeName = (
          DEFAULT_IDEA_TYPES[entry.ideaIndex % DEFAULT_IDEA_TYPES.length] as { name: string }
        ).name
        // A type without an entry is on all active fields.
        const effective = effectiveByType.get(ideaTypeName) ?? fieldNames

        for (const [name, raw] of Object.entries(entry.values)) {
          requireKnown('field', fieldNames, name)
          if (!effective.has(name)) {
            throw new Error(
              `'${scenario.slug}' idea ${entry.ideaIndex} is a '${ideaTypeName}', which does not offer '${name}'.`,
            )
          }
          const options = optionsByField.get(name) ?? []
          const encode = (label: string) => {
            if (options.length === 0) return label
            if (!options.includes(label)) {
              throw new Error(`'${name}' has no option '${label}'.`)
            }
            return optionId(name, label)
          }
          // Option fields store option ids, a MultiSelect as a comma-separated list.
          const value = typeof raw === 'string' ? encode(raw) : raw.map(encode).join(',')

          await prisma.idea_field_values.upsert({
            where: {
              idea_id_field_definition_id: { idea_id: ideaId, field_definition_id: fieldId(name) },
            },
            update: {},
            create: {
              id: seedId('idea-field-value', ideaId, name),
              idea_id: ideaId,
              field_definition_id: fieldId(name),
              value,
              created_at_utc: now,
              updated_at_utc: now,
            },
          })
        }
      }
    }
  },
}
