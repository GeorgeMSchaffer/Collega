import type { IdeaAssistContext, IdeaAssistOption } from './models.js'
import type {
  AiBusinessImpactsPort,
  AiIdeaTypesPort,
  AiMembersPort,
  AiOrganizationRepository,
  AiPromptVersionRepository,
  AiStatusesPort,
  AiTagsPort,
} from './ports.js'
import { aiPromptSetFromVersion, defaultAiPromptSet } from './prompt-defaults.js'

/** Vocabulary only - enough tag names to recognize house terms, not a full catalog. */
const TAG_SAMPLE_SIZE = 50

/** Enough names to recognize who someone means - not the whole directory. */
const MEMBER_SAMPLE_SIZE = 100

/**
 * Assembles the organization context a drafting turn is grounded in
 * (SPEC/20-feature-ai-idea-assist.md rules 11-12). Plain repository reads - no vector search, no
 * embeddings; similar-idea retrieval is v2 (D-DEDUPE).
 *
 * Everything is scoped by the `organizationId` the caller resolved from token claims. The client
 * sends no context of its own, so there is no request field an attacker could point at another
 * tenant - the isolation is structural, not validated.
 *
 * RETRIEVAL IS NOT THE CONTAINMENT MECHANISM (rule 13). It exists so the assistant can ask good
 * questions and so the response schema can be built from real option ids. Nothing here keeps the
 * conversation on topic; that is the scope gate plus the closed schema.
 */
export class IdeaAssistContextBuilder {
  constructor(
    private readonly organizations: AiOrganizationRepository,
    private readonly ideaTypes: AiIdeaTypesPort,
    private readonly businessImpacts: AiBusinessImpactsPort,
    private readonly statuses: AiStatusesPort,
    private readonly tags: AiTagsPort,
    private readonly members: AiMembersPort,
    private readonly prompts: AiPromptVersionRepository,
  ) {}

  async build(organizationId: string): Promise<IdeaAssistContext> {
    const organization = await this.organizations.getById(organizationId)

    // One more read alongside the six already here, so no caching and no invalidation to get
    // wrong. Null is the normal state - nothing published yet - and means the built-in default.
    const activePrompt = await this.prompts.getActive()

    const ideaTypes = await this.ideaTypes.listActiveWithFieldNames(organizationId)
    const businessImpacts = await this.businessImpacts.listActive(organizationId)
    const statuses = await this.statuses.listActiveNames(organizationId)
    const tags = await this.tags.searchByPrefix(organizationId, '', TAG_SAMPLE_SIZE)
    const memberNames = await this.members.listActiveDisplayNames(
      organizationId,
      MEMBER_SAMPLE_SIZE,
    )

    const ideaTypeOptions: readonly IdeaAssistOption[] = ideaTypes.map((t) => ({
      id: t.id,
      name: t.name,
      fieldNames: t.fieldNames,
    }))

    const businessImpactOptions: readonly IdeaAssistOption[] = businessImpacts.map((b) => ({
      id: b.id,
      name: b.name,
    }))

    return {
      organizationId,
      organizationName: organization?.title ?? '',
      scopeStatement: organization?.aiScopeStatement ?? null,
      ideaTypes: ideaTypeOptions,
      businessImpacts: businessImpactOptions,
      statuses,
      tags,
      memberNames,
      prompts: activePrompt ? aiPromptSetFromVersion(activePrompt) : defaultAiPromptSet(),
    }
  }
}
