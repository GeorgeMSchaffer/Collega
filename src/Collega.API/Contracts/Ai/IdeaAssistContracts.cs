using Collega.API.Validation;
using Collega.Application.Ai;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;

namespace Collega.API.Contracts.Ai;

/// <summary>
/// Request shape for `POST /api/v1/boards/{boardId}/idea-assist/turns` (SPEC/30-Contracts.md → "AI
/// Idea Assist Contracts").
/// </summary>
/// <remarks>
/// Note what is <b>absent</b>: no prompt, no system instructions, no model name, no retrieved context,
/// no scope statement, and no organization id. The server assembles all of it from the caller's token,
/// which is why a client cannot steer the assistant or reach another tenant's data.
/// </remarks>
public sealed class IdeaAssistTurnRequestContract
{
    /// <summary>Oldest-first. The final entry must have role <c>user</c>.</summary>
    [RequiredField]
    public List<IdeaAssistTurnContract> Transcript { get; set; } = new();

    /// <summary>
    /// The draft so far, so the model revises rather than restates. Unknown or inactive ids are
    /// discarded server-side rather than rejected — a stale id is a client that fell behind a catalog
    /// edit, not an attack, and failing the turn over it would be hostile.
    /// </summary>
    public IdeaDraftContract? Draft { get; set; }
}

/// <summary>One transcript entry. <c>Role</c> is <c>user</c> or <c>assistant</c>.</summary>
public sealed class IdeaAssistTurnContract
{
    [RequiredField]
    [AllowedValues(IdeaAssistTurn.UserRole, IdeaAssistTurn.AssistantRole)]
    public string Role { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(4000)]
    public string Text { get; set; } = string.Empty;
}

/// <summary>The draft fields, on both the request and the response (D-PREFILL).</summary>
public sealed class IdeaDraftContract
{
    [MaxLengthField(Idea.TitleMaxLength)]
    public string? Title { get; set; }

    [MaxLengthField(Idea.DescriptionMaxLength)]
    public string? Description { get; set; }

    public Guid? IdeaTypeId { get; set; }
    public Guid? BusinessImpactId { get; set; }
    public string? Priority { get; set; }

    public static IdeaDraftContract From(IdeaDraft draft) => new()
    {
        Title = draft.Title,
        Description = draft.Description,
        IdeaTypeId = draft.IdeaTypeId,
        BusinessImpactId = draft.BusinessImpactId,
        Priority = draft.Priority?.ToString(),
    };
}

/// <summary>Response shape for a drafting turn.</summary>
public sealed record IdeaAssistTurnResponse(
    bool InScope,
    bool ConversationClosed,
    string NextQuestion,
    IdeaDraftContract Draft,
    int TurnsRemaining);

/// <summary>
/// Request shape for `PUT /api/v1/organizations/{organizationId}/ai-assist/settings`. Null or empty
/// clears the statement, leaving active Idea Types as the only boundary.
/// </summary>
public sealed class UpdateAiAssistSettingsRequest
{
    [MaxLengthField(Organization.AiScopeStatementMaxLength)]
    public string? ScopeStatement { get; set; }
}

/// <summary>
/// Response for the settings endpoints. <c>AiAssistAvailable</c> reports only <i>whether</i> a
/// deployment key is configured — never the key, nor any part of one (rule 28).
/// </summary>
public sealed record AiAssistSettingsResponse(bool AiAssistAvailable, string? ScopeStatement);
