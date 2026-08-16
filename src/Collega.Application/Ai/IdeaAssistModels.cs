using Collega.Domain.Enums;

namespace Collega.Application.Ai;

/// <summary>
/// One entry in the conversation so far. The client owns the transcript and resends it each turn —
/// the server holds no chat state (SPEC/20-feature-ai-idea-assist.md rule 1: no persistent history).
/// </summary>
public sealed record IdeaAssistTurn(string Role, string Text)
{
    public const string UserRole = "user";
    public const string AssistantRole = "assistant";

    public bool IsUser => string.Equals(Role, UserRole, StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// The fields the assistant may propose (D-PREFILL). Every one is optional: an early turn may
/// return nothing but a question, and "the assistant hasn't decided yet" must stay distinguishable
/// from "the assistant chose nothing" all the way to the draft strip (rule 20a).
/// </summary>
/// <remarks>
/// Deliberately excludes UDF values, tags, board, and status. Board is chosen before the chat opens
/// and status defaults to the board's left-most swimlane (rule 22); UDFs and tags are v2 (rule 21).
/// </remarks>
public sealed record IdeaDraft(
    string? Title = null,
    string? Description = null,
    Guid? IdeaTypeId = null,
    Guid? BusinessImpactId = null,
    Priority? Priority = null)
{
    public static readonly IdeaDraft Empty = new();

    public bool HasAnyValue =>
        Title is not null || Description is not null || IdeaTypeId is not null
        || BusinessImpactId is not null || Priority is not null;
}

/// <summary>What the caller asks for: one turn of conversation against a board.</summary>
public sealed record IdeaAssistTurnRequest(
    Guid BoardId,
    IReadOnlyList<IdeaAssistTurn> Transcript,
    IdeaDraft? Draft = null);

/// <summary>
/// What the caller gets back. <paramref name="NextQuestion"/> is the <b>only</b> free-text field the
/// model produces (rule 15) — there is deliberately no channel in which a limerick or a
/// general-knowledge answer could be returned.
/// </summary>
public sealed record IdeaAssistTurnResult(
    bool InScope,
    bool ConversationClosed,
    string NextQuestion,
    IdeaDraft Draft,
    int TurnsRemaining);

/// <summary>
/// The organization context assembled server-side and handed to the model (rules 11–12). The client
/// never sends any of this; it is built from the caller's token claims alone, which is what makes
/// cross-org retrieval structurally impossible rather than prompt-discouraged.
/// </summary>
public sealed record IdeaAssistContext(
    Guid OrganizationId,
    string OrganizationName,
    string? ScopeStatement,
    IReadOnlyList<IdeaAssistOption> IdeaTypes,
    IReadOnlyList<IdeaAssistOption> BusinessImpacts,
    IReadOnlyList<string> Statuses,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> MemberNames)
{
    /// <summary>Active idea-type ids — the closed enum the response schema is built from (rule 16).</summary>
    public IReadOnlyList<Guid> IdeaTypeIds => IdeaTypes.Select(t => t.Id).ToList();

    public IReadOnlyList<Guid> BusinessImpactIds => BusinessImpacts.Select(b => b.Id).ToList();
}

/// <summary>
/// One selectable option with the context needed to ask a good question about it. <paramref name="FieldNames"/>
/// is the type's resolved field set — included so the assistant knows what a type will eventually
/// need, <b>not</b> so it can fill those values (rule 12; UDF pre-fill is out of v1 scope).
/// </summary>
public sealed record IdeaAssistOption(
    Guid Id,
    string Name,
    string? Description = null,
    IReadOnlyList<string>? FieldNames = null);

/// <summary>
/// What the model returned, before the service re-validates it. Separate from
/// <see cref="IdeaAssistTurnResult"/> on purpose: everything here is <b>untrusted</b> until every id
/// has been checked against the retrieved set (rule 16 / contract line 1274).
/// </summary>
public sealed record IdeaDraftModelResponse(
    bool InScope,
    string NextQuestion,
    IdeaDraft Draft,
    int InputTokens,
    int OutputTokens,
    int CacheReadInputTokens = 0,
    int CacheCreationInputTokens = 0);
