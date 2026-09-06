import type { IdeaAssistContext } from '@collega/application/ai'
import { businessImpactIdsOf, ideaTypeIdsOf } from '@collega/application/ai'
import { Priority } from '@collega/domain/enums'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@collega/domain/ideas'

const PRIORITY_NAMES: readonly string[] = Object.values(Priority)

/**
 * Builds the response JSON Schema PER REQUEST from the retrieval result (SPEC/20-feature-ai-idea-
 * assist.md rules 15-18), ported from .NET's `IdeaDraftSchema`.
 *
 * This is the containment mechanism. Because `ideaTypeId` and `businessImpactId` are closed
 * enums of this organization's real, active option ids, an invalid or cross-org classification is
 * structurally impossible - not prompt-discouraged. `additionalProperties` is false and every
 * enum is closed, so `nextQuestion` is the only string the model can author.
 */
export function buildIdeaDraftResponseSchema(context: IdeaAssistContext): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      inScope: {
        type: 'boolean',
        description:
          "True when the user's latest message could plausibly become an idea of one of this " +
          "organization's active idea types, within any scope statement given. False otherwise.",
      },
      nextQuestion: {
        type: 'string',
        description:
          'One short follow-up question that moves the draft forward. This is the only free ' +
          'text you may write.',
      },
      title: nullable({ type: 'string', maxLength: TITLE_MAX_LENGTH }),
      description: nullable({ type: 'string', maxLength: DESCRIPTION_MAX_LENGTH }),
      ideaTypeId: nullableEnum(
        ideaTypeIdsOf(context),
        "The idea type, chosen from this organization's active types.",
      ),
      businessImpactId: nullableEnum(
        businessImpactIdsOf(context),
        "The business impact, chosen from this organization's active options.",
      ),
      priority: {
        anyOf: [{ type: 'string', enum: PRIORITY_NAMES }, { type: 'null' }],
      },
    },
    // inScope and nextQuestion are always required; the draft fields stay optional because an
    // early turn legitimately proposes nothing but a question.
    required: ['inScope', 'nextQuestion'],
    additionalProperties: false,
  }
}

function nullable(constrained: Record<string, unknown>): Record<string, unknown> {
  return { anyOf: [constrained, { type: 'null' }] }
}

/** A closed enum of the retrieved ids, or a bare null type when the organization has none - an
 * empty `enum` array is not valid JSON Schema, and "no options" must still be expressible. */
function nullableEnum(ids: readonly string[], description: string): Record<string, unknown> {
  if (ids.length === 0) {
    return { type: 'null', description }
  }

  return {
    description,
    anyOf: [{ type: 'string', enum: ids }, { type: 'null' }],
  }
}
