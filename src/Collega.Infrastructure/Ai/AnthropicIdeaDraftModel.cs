using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;
using Collega.Application.Abstractions;
using Collega.Application.Ai;
using Collega.Domain.Enums;

// Both namespaces define `Role` — the SDK's message role and the product's user role. Alias rather
// than dropping a using: this file legitimately needs Priority from Domain.Enums.
using MessageRole = Anthropic.Models.Messages.Role;

namespace Collega.Infrastructure.Ai;

/// <summary>
/// The Anthropic-backed <see cref="IIdeaDraftModel"/> (SPEC/20-feature-ai-idea-assist.md "Model
/// Configuration"). The only file in the solution that knows a model vendor exists.
/// </summary>
/// <remarks>
/// <para><b>Structured outputs, not prose parsing.</b> The response is constrained by a per-request
/// JSON Schema built from the organization's real option ids (<see cref="IdeaDraftSchema"/>), which is
/// what makes an invalid classification structurally impossible. Prefill is not an option — it returns
/// 400 on this model generation.</para>
///
/// <para><b>Adaptive thinking, low effort.</b> <c>budget_tokens</c> is removed on Sonnet 5 and returns
/// 400; depth is controlled by <c>output_config.effort</c> instead. Effort starts at <c>low</c>
/// because thinking is on by default here and bills as output at five times the input rate — it is the
/// largest cost lever the feature has. Do not disable thinking to save money; lower the effort.</para>
///
/// <para><b>MaxTokens caps thinking plus response together.</b> Sizing it to the response alone
/// truncates mid-answer once thinking is on.</para>
/// </remarks>
public sealed class AnthropicIdeaDraftModel : IIdeaDraftModel
{
    /// <summary>
    /// Generous relative to a one-question answer because it must also cover thinking. The response
    /// itself is schema-constrained and small.
    /// </summary>
    private const int MaxTokens = 8_000;

    private static readonly JsonSerializerOptions ResponseJson = new(JsonSerializerDefaults.Web);

    private readonly AiUsageLimits _limits;
    private readonly AnthropicClient? _client;

    public AnthropicIdeaDraftModel(AiUsageLimits limits, AiCredentials credentials)
    {
        _limits = limits;

        // No key is a supported state, not a misconfiguration (rule 31): the feature runs dark and
        // the product keeps working. Constructing no client at all makes that unambiguous.
        _client = string.IsNullOrWhiteSpace(credentials.ApiKey)
            ? null
            : new AnthropicClient { ApiKey = credentials.ApiKey };
    }

    public bool IsConfigured => _client is not null;

    public async Task<IdeaDraftModelResponse> ContinueAsync(
        IdeaAssistContext context,
        IReadOnlyList<IdeaAssistTurn> transcript,
        IdeaDraft currentDraft,
        CancellationToken cancellationToken = default)
    {
        if (_client is null)
        {
            throw new IdeaDraftModelException("AI assist is not configured.");
        }

        var messages = BuildMessages(context, transcript, currentDraft);

        Message response;
        try
        {
            response = await _client.Messages.Create(new MessageCreateParams
            {
                Model = _limits.Model,
                MaxTokens = MaxTokens,

                // The stable prefix — system prompt plus the organization catalog — is identical for
                // every turn of every conversation in this organization, so it sits behind one cache
                // breakpoint. Only the transcript varies, and it comes after.
                System = new List<TextBlockParam>
                {
                    new()
                    {
                        Text = IdeaAssistPromptBuilder.BuildSystemPrompt(context),
                        CacheControl = new CacheControlEphemeral(),
                    },
                },
                Thinking = new ThinkingConfigAdaptive(),
                OutputConfig = new OutputConfig
                {
                    Effort = ResolveEffort(_limits.Effort),
                    Format = new JsonOutputFormat { Schema = IdeaDraftSchema.Build(context) },
                },
                Messages = messages,
            });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Every provider failure degrades identically (rule 32) — the user keeps their typed text
            // and the turn falls back to the scripted nudge.
            throw new IdeaDraftModelException("The idea assist model call failed.", ex);
        }

        // A safety classifier can decline the request outright. That is a normal 200 with no usable
        // content, not an exception — treat it as an unusable turn rather than reading Content[0].
        if (response.StopReason == "refusal")
        {
            throw new IdeaDraftModelException("The model declined the request.");
        }

        return Parse(response);
    }

    private static List<MessageParam> BuildMessages(
        IdeaAssistContext context,
        IReadOnlyList<IdeaAssistTurn> transcript,
        IdeaDraft currentDraft)
    {
        var messages = transcript
            .Select(entry => new MessageParam
            {
                Role = entry.IsUser ? MessageRole.User : MessageRole.Assistant,
                Content = entry.Text,
            })
            .ToList();

        // The draft rides with the final user turn rather than in the system prompt: it changes every
        // turn, and anything volatile in the prefix invalidates the cache for the whole organization.
        var last = messages[^1];
        messages[^1] = new MessageParam
        {
            Role = last.Role,
            Content = $"{IdeaAssistPromptBuilder.BuildDraftNote(currentDraft, context)}\n\n{transcript[^1].Text}",
        };

        return messages;
    }

    private static IdeaDraftModelResponse Parse(Message response)
    {
        var json = response.Content
            .Select(block => block.TryPickText(out TextBlock? text) ? text.Text : null)
            .FirstOrDefault(text => !string.IsNullOrWhiteSpace(text));

        if (string.IsNullOrWhiteSpace(json))
        {
            throw new IdeaDraftModelException("The model returned no content.");
        }

        SchemaResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<SchemaResponse>(json, ResponseJson);
        }
        catch (JsonException ex)
        {
            throw new IdeaDraftModelException("The model returned malformed JSON.", ex);
        }

        if (parsed is null)
        {
            throw new IdeaDraftModelException("The model returned malformed JSON.");
        }

        return new IdeaDraftModelResponse(
            parsed.InScope,
            parsed.NextQuestion ?? string.Empty,
            new IdeaDraft(
                parsed.Title,
                parsed.Description,
                ParseGuid(parsed.IdeaTypeId),
                ParseGuid(parsed.BusinessImpactId),
                ParsePriority(parsed.Priority)),
            (int)response.Usage.InputTokens,
            (int)response.Usage.OutputTokens,
            (int)(response.Usage.CacheReadInputTokens ?? 0),
            (int)(response.Usage.CacheCreationInputTokens ?? 0));
    }

    private static Guid? ParseGuid(string? value) =>
        Guid.TryParse(value, out var parsed) ? parsed : null;

    private static Priority? ParsePriority(string? value) =>
        Enum.TryParse<Priority>(value, ignoreCase: true, out var parsed) ? parsed : null;

    /// <summary>
    /// Maps the configured effort string onto the SDK enum, defaulting to <c>low</c> for anything
    /// unrecognized. Silently spending more than configured because a value was misspelled is the
    /// wrong failure direction for a cost lever.
    /// </summary>
    private static Effort ResolveEffort(string? configured) => configured?.Trim().ToLowerInvariant() switch
    {
        "medium" => Effort.Medium,
        "high" => Effort.High,
        "max" => Effort.Max,
        _ => Effort.Low,
    };

    /// <summary>Mirrors the per-request schema. Deserialization target only.</summary>
    private sealed record SchemaResponse
    {
        public bool InScope { get; init; }
        public string? NextQuestion { get; init; }
        public string? Title { get; init; }
        public string? Description { get; init; }
        public string? IdeaTypeId { get; init; }
        public string? BusinessImpactId { get; init; }
        public string? Priority { get; init; }
    }
}

/// <summary>
/// The deployment-level AI credential (rule 29). A plain options class bound in
/// <c>AddInfrastructure</c>, matching <c>AccessTokenOptions</c> and <c>AiUsageLimits</c>.
/// </summary>
/// <remarks>
/// Empty is valid and means the feature is off. This type exists so the key has exactly one home in
/// the object graph: it is never logged, never returned by an endpoint, and never sent to the client.
/// </remarks>
public sealed class AiCredentials
{
    public string? ApiKey { get; init; }
}
