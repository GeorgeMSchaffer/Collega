import type { AiPromptSet, IdeaAssistContext } from '@collega/application/ai'
import { buildSystemPrompt } from '@collega/application/ai'
import { buildIdeaDraftResponseSchema } from '@collega/infrastructure/integrations/ai'
import type { EvalCase, EvalFixture } from './corpus.ts'
import { canonicalJson, nameDerivedId, sha256 } from './hashing.ts'

export interface CatalogOption {
  readonly id: string
  readonly name: string
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
   * Recorded for `compare`; see the slice 114 report on rules 19 and 34.
   */
  readonly catalogSha256: string
  /** The derived ids, so a saved run can name the options without the corpus. */
  readonly catalog: {
    readonly organizationId: string
    readonly ideaTypes: readonly CatalogOption[]
    readonly businessImpacts: readonly CatalogOption[]
  }
}

const CATALOG_ONLY_TEMPLATE = '{{ORGANIZATION_CATALOG}}\n{{SCOPE_STATEMENT}}'

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
    prompts,
  }
}

export function prepareFixture(fixture: EvalFixture, prompts: AiPromptSet): PreparedFixture {
  const context = fixtureContext(fixture, prompts)
  const systemPrompt = buildSystemPrompt(context)
  const responseSchema = buildIdeaDraftResponseSchema(context)
  const catalogOnly = buildSystemPrompt({
    ...context,
    prompts: { ...prompts, systemPromptTemplate: CATALOG_ONLY_TEMPLATE },
  })

  return {
    name: fixture.name,
    context,
    systemPrompt,
    responseSchema,
    contentSha256: sha256(canonicalJson({ systemPrompt, responseSchema })),
    catalogSha256: sha256(canonicalJson({ catalog: catalogOnly, responseSchema })),
    catalog: {
      organizationId: context.organizationId,
      ideaTypes: context.ideaTypes.map(({ id, name }) => ({ id, name })),
      businessImpacts: context.businessImpacts.map(({ id, name }) => ({ id, name })),
    },
  }
}

/** Rule 19: what drives a case - not its note, `pair` or `assistant`. */
export function caseContentSha256(evalCase: EvalCase): string {
  return sha256(
    canonicalJson({ fixture: evalCase.fixture, turns: evalCase.turns, expect: evalCase.expect }),
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
