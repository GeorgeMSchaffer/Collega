namespace Collega.Application.Collaboration;

/// <summary>
/// Resolves raw @-mention email strings to same-organization active user ids
/// (SPEC/20-feature-ideas-and-engagement.md "Mentions"). Shared by idea and comment use cases.
/// </summary>
public interface IMentionResolver
{
    /// <summary>
    /// Resolves each email to a distinct active user in <paramref name="organizationId"/>. Any email
    /// that does not resolve to a same-organization user throws a <see
    /// cref="Collega.Application.Exceptions.ValidationAppException"/> keyed on
    /// <paramref name="fieldName"/>, matching the contract's "block save until corrected" rule.
    /// Site Admin has no organization and can never be mentioned.
    /// </summary>
    Task<IReadOnlyList<Guid>> ResolveAsync(
        Guid organizationId,
        IReadOnlyCollection<string>? mentionEmails,
        string fieldName,
        CancellationToken cancellationToken = default);
}
