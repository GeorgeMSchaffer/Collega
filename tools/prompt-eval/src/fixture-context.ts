import type {
  AiPromptSet,
  IdeaAssistContext,
  IdeaAssistFieldDefinition,
} from '@collega/application/ai'
import { buildIdeaAssistTurnSchemaV2, buildSystemPrompt } from '@collega/application/ai'
import { buildIdeaDraftResponseSchema } from '@collega/infrastructure/integrations/ai'
import type { EvalCase, EvalFixture, FixtureFieldType } from './corpus.ts'
import { canonicalJson, nameDerivedId, sha256 } from './hashing.ts'

export interface CatalogOption {
  readonly id: string
  readonly name: string
}

/** A v2 typed field with its derived id, and its options' ids when it is a dropdown. */
export interface CatalogField {
  readonly id: string
  readonly name: string
  readonly type: FixtureFieldType
  readonly options?: readonly CatalogOption[]
}

/** One fixture as a run sees it: the context handed to the model and what it renders to. */
export interface PreparedFixture {
  readonly name: string
  readonly context: IdeaAssistContext
  readonly systemPrompt: string
  readonly responseSchema: Record<string, unknown>
  /** Rule 19: the rendered system prompt and response schema. */
  readonly contentSha256: string
  /**
   * The catalog and scope statement as `buildSystemPrompt` renders them, plus the schema - the
   * same content with the template left out, so it stays equal across a prompt change.
   * `compare` checks like with like on this one (rules 19 and 34).
   */
  readonly catalogSha256: string
  /** The derived ids, so a saved run can name the options without the corpus. */
  readonly catalog: {
    readonly organizationId: string
    readonly ideaTypes: readonly CatalogOption[]
    readonly businessImpacts: readonly CatalogOption[]
    /** v2 fixtures only. */
    readonly fields?: readonly CatalogField[]
  }
}

const CATALOG_ONLY_TEMPLATE = '{{ORGANIZATION_CATALOG}}\n{{SCOPE_STATEMENT}}'

/** Which turn a run drives: v1's, or v2's (runner spec rule 33). */
export type RunAssistant = 'v1' | 'v2'

// `FieldType` lives in @collega/domain, which this package does not depend on; the values are the
// enum's own, so the cast only bridges the nominal string enum.
const FIELD_TYPE_NAMES = { text: 'Text', number: 'Number', dropdown: 'Dropdown' } as const

/** Rule 6: ids from `fixture/kind/name`, and the organization's from `fixture/organization/name`. */
export function fixtureContext(fixture: EvalFixture, prompts: AiPromptSet): IdeaAssistContext {
  const idOf = (kind: string, name: string) => nameDerivedId(`${fixture.name}/${kind}/${name}`)
  return {
    organizationId: idOf('organization', fixture.name),
    organizationName: fixture.organizationName,
    scopeStatement: fixture.scopeStatement,
    ideaTypes: fixture.ideaTypes.map((t) => ({
      id: idOf('ideaType', t.name),
      name: t.name,
      fieldNames: t.fieldNames ?? [],
    })),
    businessImpacts: fixture.businessImpacts.map((b) => ({
      id: idOf('businessImpact', b.name),
      name: b.name,
    })),
    statuses: fixture.statuses,
    tags: fixture.tags,
    memberNames: fixture.memberNames,
    ...(fixture.fields === undefined ? {} : { fieldsByIdeaType: fieldsByIdeaType(fixture, idOf) }),
    prompts,
  }
}

/** v2: the typed fields each idea type shows, as the context builder hands them to the model. */
function fieldsByIdeaType(
  fixture: EvalFixture,
  idOf: (kind: string, name: string) => string,
): Record<string, IdeaAssistFieldDefinition[]> {
  const catalog = catalogFields(fixture) ?? []
  return Object.fromEntries(
    fixture.ideaTypes.map((type) => [
      idOf('ideaType', type.name),
      (type.fieldNames ?? []).flatMap((name) => {
        const field = catalog.find((f) => f.name === name)
        if (field === undefined) return []
        return [
          {
            id: field.id,
            name: field.name,
            fieldType: FIELD_TYPE_NAMES[
              field.type
            ] as unknown as IdeaAssistFieldDefinition['fieldType'],
            isRequired: (type.requiredFieldNames ?? []).includes(name),
            options: (field.options ?? []).map((o) => ({ id: o.id, label: o.name })),
          },
        ]
      }),
    ]),
  )
}

/** Rule 6's derivation for typed fields: `fixture/field/name`, `fixture/fieldOption/field/name`. */
export function catalogFields(fixture: EvalFixture): CatalogField[] | undefined {
  return fixture.fields?.map((field) => ({
    id: nameDerivedId(`${fixture.name}/field/${field.name}`),
    name: field.name,
    type: field.type,
    ...(field.options === undefined
      ? {}
      : {
          options: field.options.map((option) => ({
            id: nameDerivedId(`${fixture.name}/fieldOption/${field.name}/${option}`),
            name: option,
          })),
        }),
  }))
}

export function prepareFixture(
  fixture: EvalFixture,
  prompts: AiPromptSet,
  assistant: RunAssistant = 'v1',
): PreparedFixture {
  const context = fixtureContext(fixture, prompts)
  const fields = catalogFields(fixture)
  // Typed fields are not in the v1 prompt, so they join the hashes explicitly - and only when a
  // fixture has them, which leaves every v1 fixture's hashes as they were.
  const typed = fields === undefined ? {} : { fields }
  const systemPrompt = buildSystemPrompt(context)
  // A v2 turn's schema depends on the draft's locked fields and idea type, so the fixture-level one
  // recorded here is the widest: nothing locked, every type's fields. Each call builds its own.
  const responseSchema =
    assistant === 'v2'
      ? buildIdeaAssistTurnSchemaV2(context, {
          lockedFields: [],
          customFields: Object.values(context.fieldsByIdeaType ?? {}).flat(),
        })
      : buildIdeaDraftResponseSchema(context)
  const catalogOnly = buildSystemPrompt({
    ...context,
    prompts: { ...prompts, systemPromptTemplate: CATALOG_ONLY_TEMPLATE },
  })

  return {
    name: fixture.name,
    context,
    systemPrompt,
    responseSchema,
    contentSha256: sha256(canonicalJson({ systemPrompt, responseSchema, ...typed })),
    catalogSha256: sha256(canonicalJson({ catalog: catalogOnly, responseSchema, ...typed })),
    catalog: {
      organizationId: context.organizationId,
      ideaTypes: context.ideaTypes.map(({ id, name }) => ({ id, name })),
      businessImpacts: context.businessImpacts.map(({ id, name }) => ({ id, name })),
      ...typed,
    },
  }
}

/**
 * Rule 19: what drives a case - not its note, `pair` or `assistant`. A v2 case's starting `draft`
 * and `lockedFields` drive it too, so they join the hash when present, which leaves every v1
 * case's hash as it was.
 */
export function caseContentSha256(evalCase: EvalCase): string {
  return sha256(
    canonicalJson({
      fixture: evalCase.fixture,
      turns: evalCase.turns,
      expect: evalCase.expect,
      ...(evalCase.draft === null ? {} : { draft: evalCase.draft }),
      ...(evalCase.lockedFields.length === 0 ? {} : { lockedFields: evalCase.lockedFields }),
    }),
  )
}

/** The priorities the production schema allows - the closed set a case may expect. */
export function schemaPriorities(): readonly string[] {
  const schema = buildIdeaDraftResponseSchema(
    fixtureContext(
      {
        name: '',
        organizationName: '',
        scopeStatement: null,
        ideaTypes: [],
        businessImpacts: [],
        statuses: [],
        tags: [],
        memberNames: [],
        file: '',
      },
      {
        systemPromptTemplate: '',
        outOfScopeRedirect: '',
        conversationClosedRedirect: '',
        version: null,
      },
    ),
  ) as { properties: { priority: { anyOf: [{ enum: string[] }] } } }
  return schema.properties.priority.anyOf[0].enum
}
