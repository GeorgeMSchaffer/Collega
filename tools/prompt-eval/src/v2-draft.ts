import type { IdeaDraft } from '@collega/application/ai'
import type { CaseDraft } from './corpus.ts'
import type { RunFixture, V2Draft } from './run-file.ts'

/**
 * The v2 draft on the wire from a case's prose draft: names become the fixture's derived ids.
 * The v2 turn's runner sends this as the first `draft`; the scorer compares locked fields with it.
 */
export function wireDraft(
  draft: CaseDraft | null | undefined,
  fixture: Pick<RunFixture, 'ideaTypes' | 'businessImpacts' | 'fields'>,
): V2Draft {
  const fields = fixture.fields ?? []
  return {
    title: draft?.title ?? null,
    problem: draft?.problem ?? null,
    proposedSolutions: draft?.proposedSolutions ?? [],
    impactRationale: draft?.impactRationale ?? null,
    businessImpactId:
      fixture.businessImpacts.find((o) => o.name === draft?.businessImpact)?.id ?? null,
    ideaTypeId: fixture.ideaTypes.find((o) => o.name === draft?.ideaType)?.id ?? null,
    priority: draft?.priority ?? null,
    tagNames: draft?.tags ?? [],
    fieldValues: Object.entries(draft?.fieldValues ?? {}).flatMap(([name, value]) => {
      const field = fields.find((f) => f.name === name)
      if (field === undefined) return []
      const option = field.options?.find((o) => o.name === value)
      return [{ fieldDefinitionId: field.id, value: option?.id ?? value }]
    }),
    description: draft?.description ?? null,
  }
}

/** A v1 draft seen as a v2 one, so the scorer reads a single shape. */
export function fromV1Draft(draft: IdeaDraft): V2Draft {
  return {
    title: draft.title,
    problem: null,
    proposedSolutions: [],
    impactRationale: null,
    businessImpactId: draft.businessImpactId,
    ideaTypeId: draft.ideaTypeId,
    priority: draft.priority,
    tagNames: [],
    fieldValues: [],
    description: draft.description,
  }
}

/**
 * The v2 contract's name for a draft field (`problem`, `ideaTypeId`, `fieldValues.<id>`), given
 * a case's name for it, which spells a custom field by name (`fieldValues.<name>`).
 */
export function wireFieldName(name: string, fixture: Pick<RunFixture, 'fields'>): string {
  if (!name.startsWith('fieldValues.')) return name
  const field = fixture.fields?.find((f) => f.name === name.slice('fieldValues.'.length))
  return field === undefined ? name : `fieldValues.${field.id}`
}

/** One field's value in a draft or a set of changes, by its wire name; undefined when absent. */
export function fieldValueOf(draft: Partial<V2Draft>, wireName: string): unknown {
  if (wireName.startsWith('fieldValues.')) {
    const id = wireName.slice('fieldValues.'.length)
    return draft.fieldValues?.find((v) => v.fieldDefinitionId === id)?.value
  }
  return (draft as Record<string, unknown>)[wireName]
}

/** The draft after a turn: the changes laid over it, a custom field replacing its earlier value. */
export function applyChanges(draft: V2Draft, changes: Partial<V2Draft>): V2Draft {
  const { fieldValues, ...rest } = changes
  const merged = new Map(draft.fieldValues.map((v) => [v.fieldDefinitionId, v]))
  for (const v of fieldValues ?? []) merged.set(v.fieldDefinitionId, v)
  return { ...draft, ...rest, fieldValues: [...merged.values()] }
}
