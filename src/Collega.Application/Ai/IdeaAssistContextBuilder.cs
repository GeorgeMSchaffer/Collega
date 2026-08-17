using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Enums;
using Collega.Domain.IdeaFields;

namespace Collega.Application.Ai;

/// <summary>
/// Assembles the organization context a drafting turn is grounded in
/// (SPEC/20-feature-ai-idea-assist.md rules 11–12). Plain repository reads — no vector search, no
/// embeddings; similar-idea retrieval is v2 (D-DEDUPE).
/// </summary>
/// <remarks>
/// <para>Everything is scoped by the <c>organizationId</c> the caller resolved from token claims. The
/// client sends no context of its own, so there is no request field an attacker could point at
/// another tenant — the isolation is structural, not validated.</para>
///
/// <para><b>Retrieval is not the containment mechanism</b> (rule 13). It exists so the assistant can
/// ask good questions and so the response schema can be built from real option ids. Nothing here
/// keeps the conversation on topic; that is the scope gate plus the closed schema.</para>
/// </remarks>
public sealed class IdeaAssistContextBuilder
{
    /// <summary>Vocabulary only — enough tag names to recognize house terms, not a full catalog.</summary>
    private const int TagSampleSize = 50;

    /// <summary>Enough names to recognize who someone means — not the whole directory.</summary>
    private const int MemberSampleSize = 100;

    private readonly IOrganizationRepository _organizations;
    private readonly IIdeaTypeRepository _ideaTypes;
    private readonly IBusinessImpactRepository _businessImpacts;
    private readonly IFieldDefinitionRepository _fieldDefinitions;
    private readonly IStatusRepository _statuses;
    private readonly ITagRepository _tags;
    private readonly IUserRepository _users;
    private readonly IAiPromptVersionRepository _prompts;

    public IdeaAssistContextBuilder(
        IOrganizationRepository organizations,
        IIdeaTypeRepository ideaTypes,
        IBusinessImpactRepository businessImpacts,
        IFieldDefinitionRepository fieldDefinitions,
        IStatusRepository statuses,
        ITagRepository tags,
        IUserRepository users,
        IAiPromptVersionRepository prompts)
    {
        _organizations = organizations;
        _ideaTypes = ideaTypes;
        _businessImpacts = businessImpacts;
        _fieldDefinitions = fieldDefinitions;
        _statuses = statuses;
        _tags = tags;
        _users = users;
        _prompts = prompts;
    }

    public async Task<IdeaAssistContext> BuildAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        var organization = await _organizations.GetByIdAsync(organizationId, cancellationToken);

        // One more read alongside the seven already here, so no caching and no invalidation to get
        // wrong. Null is the normal state — nothing published yet — and means the built-in default.
        var activePrompt = await _prompts.GetActiveAsync(cancellationToken);

        var ideaTypes = await _ideaTypes.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        var businessImpacts = await _businessImpacts.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        var activeFields = await _fieldDefinitions.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        var statuses = await _statuses.ListActiveByOrganizationAsync(organizationId, cancellationToken);
        var tags = await _tags.SearchByPrefixAsync(organizationId, string.Empty, TagSampleSize, cancellationToken);

        // Read directly rather than through IUserService: that service applies its own read-scope
        // authorization, and the caller's scope was already settled before retrieval began. Going
        // through it would re-authorize the same organization a second time to no effect.
        var members = await _users.ListByOrganizationAsync(
            new UserListFilter(
                organizationId,
                new PageRequest(1, MemberSampleSize),
                Search: null,
                Role: null,
                Status: UserStatus.Active,
                SortBy: null,
                SortDirection: null),
            cancellationToken);

        return new IdeaAssistContext(
            organizationId,
            organization?.Title ?? string.Empty,
            organization?.AiScopeStatement,
            ideaTypes
                .Where(t => !t.IsDeleted)
                .OrderBy(t => t.SortOrder)
                .Select(t => new IdeaAssistOption(
                    t.Id,
                    t.Name,
                    // The resolved field set tells the assistant what this type will eventually need,
                    // so it can ask about it — v1 never fills those values (rule 21).
                    Description: null,
                    FieldNames: IdeaTypeFieldResolver
                        .ResolveEffectiveFields(t, activeFields)
                        .Select(f => f.Field.Name)
                        .ToList()))
                .ToList(),
            businessImpacts
                .Where(b => !b.IsDeleted)
                .OrderBy(b => b.SortOrder)
                .Select(b => new IdeaAssistOption(b.Id, b.Name))
                .ToList(),
            statuses.OrderBy(s => s.SortOrder).Select(s => s.Name).ToList(),
            tags,
            members.Items.Select(u => $"{u.FirstName} {u.LastName}".Trim()).ToList(),
            activePrompt is null ? AiPromptDefaults.Default : AiPromptDefaults.From(activePrompt));
    }
}
