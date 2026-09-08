using Collega.Domain.Common;

namespace Collega.Domain.Ai;

/// <summary>
/// One published version of the idea-assist system prompt and its two fixed redirect strings
/// (SPEC/20-feature-ai-idea-assist.md rules 34–36).
/// </summary>
/// <remarks>
/// <para><b>The first platform-scoped entity in the domain.</b> Every other persisted type carries an
/// <c>OrganizationId</c>; this one deliberately does not. The prompt is one setting for the whole
/// deployment, exactly like the API key in rule 29 — not organization content. A future reader should
/// not "fix" the missing scope.</para>
///
/// <para><b>Append-only.</b> Publishing writes a new row and moves the active pointer; restoring an
/// earlier version writes a <i>copy</i> of it as a new row. Nothing here is ever edited in place, so the
/// history answers "what was live when quality changed" — a question the audit log cannot answer, since
/// rule 27 forbids it from storing prompt content.</para>
///
/// <para><b>What this type does not control.</b> The <c>&lt;organization_data&gt;</c> block and its
/// escaping are assembled in Infrastructure and rendered into <see cref="OrganizationCatalogPlaceholder"/>.
/// No stored body can reintroduce the fence-closing defect the Sprint 7 review found. It <i>can</i>
/// delete the prose telling the model to distrust that block — the escaping survives, the instruction
/// does not, which is why publishing offers safety probes (rule 37).</para>
/// </remarks>
public sealed class AiPromptVersion : EntityBase
{
    /// <summary>Where the server renders the fenced, escaped organization catalog. Required in every body.</summary>
    public const string OrganizationCatalogPlaceholder = "{{ORGANIZATION_CATALOG}}";

    /// <summary>
    /// Where the server renders the fenced scope statement, or nothing when the organization has none.
    /// Required even though it is often empty at render time: a body omitting it would silently disable
    /// every organization's scope statement (rule 6) with no error raised anywhere.
    /// </summary>
    public const string ScopeStatementPlaceholder = "{{SCOPE_STATEMENT}}";

    /// <summary>
    /// Generous: a working prompt is a couple of thousand characters and operators need room to explain
    /// themselves. The real cost control is that this text sits behind the cache breakpoint, so length
    /// is paid for once per cache window rather than per turn.
    /// </summary>
    public const int BodyMaxLength = 20_000;

    /// <summary>
    /// Short, matching <c>Organization.AiScopeStatementMaxLength</c>. These are one-line messages shown
    /// in a chat bubble, not documents.
    /// </summary>
    public const int RedirectMaxLength = 500;

    private AiPromptVersion()
    {
    }

    /// <summary>Monotonic and human-facing — this is what the UI and the audit event name.</summary>
    public int Version { get; private set; }

    public string Body { get; private set; } = string.Empty;

    public string OutOfScopeRedirect { get; private set; } = string.Empty;

    public string ConversationClosedRedirect { get; private set; } = string.Empty;

    /// <summary>
    /// Exactly one row is active at a time, or none — in which case the built-in default compiled into
    /// the product is used. "No rows" is therefore the normal initial state, and resetting to the
    /// default is deactivating all rather than inserting anything.
    /// </summary>
    public bool IsActive { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid? CreatedByUserId { get; private set; }

    /// <summary>
    /// Publishes a new version. <paramref name="version"/> is supplied by the caller, which owns the
    /// sequence because only it can see the existing rows.
    /// </summary>
    /// <exception cref="ArgumentException">A field is empty, over length, or missing a required placeholder.</exception>
    public static AiPromptVersion Publish(
        int version,
        string body,
        string outOfScopeRedirect,
        string conversationClosedRedirect,
        DateTime nowUtc,
        Guid? actorUserId)
    {
        var normalizedBody = (body ?? string.Empty).Trim();
        var normalizedOutOfScope = (outOfScopeRedirect ?? string.Empty).Trim();
        var normalizedClosed = (conversationClosedRedirect ?? string.Empty).Trim();

        Require(normalizedBody.Length > 0, "body", "The prompt body is required.");
        Require(normalizedBody.Length <= BodyMaxLength, "body", $"The prompt body cannot exceed {BodyMaxLength} characters.");

        // Checked here rather than only at the API edge: this is the invariant that keeps the catalog
        // and the scope statement reachable at all, so it must hold for every path that writes a row.
        Require(
            normalizedBody.Contains(OrganizationCatalogPlaceholder, StringComparison.Ordinal),
            "body",
            $"The prompt body must contain {OrganizationCatalogPlaceholder}, which is where the organization's "
            + "idea types and business impacts are rendered. Without it the assistant has no catalog to classify against.");

        Require(
            normalizedBody.Contains(ScopeStatementPlaceholder, StringComparison.Ordinal),
            "body",
            $"The prompt body must contain {ScopeStatementPlaceholder}. Without it, every organization's "
            + "scope statement would be silently ignored.");

        Require(normalizedOutOfScope.Length > 0, "outOfScopeRedirect", "The out-of-scope redirect is required.");
        Require(
            normalizedOutOfScope.Length <= RedirectMaxLength,
            "outOfScopeRedirect",
            $"The out-of-scope redirect cannot exceed {RedirectMaxLength} characters.");

        Require(normalizedClosed.Length > 0, "conversationClosedRedirect", "The conversation-closed redirect is required.");
        Require(
            normalizedClosed.Length <= RedirectMaxLength,
            "conversationClosedRedirect",
            $"The conversation-closed redirect cannot exceed {RedirectMaxLength} characters.");

        return new AiPromptVersion
        {
            Id = Guid.NewGuid(),
            Version = version,
            Body = normalizedBody,
            OutOfScopeRedirect = normalizedOutOfScope,
            ConversationClosedRedirect = normalizedClosed,
            IsActive = true,
            CreatedAtUtc = nowUtc,
            CreatedByUserId = actorUserId,
        };
    }

    /// <summary>
    /// Stands this version down. Called on the previously active row when a new one is published, and
    /// on every row when resetting to the built-in default.
    /// </summary>
    public void Deactivate() => IsActive = false;

    // ArgumentException with a parameter name, matching Organization.SetAiScopeStatement — the
    // Application layer maps these onto ValidationAppException at the boundary.
    private static void Require(bool condition, string field, string message)
    {
        if (!condition)
        {
            throw new ArgumentException(message, field);
        }
    }
}
