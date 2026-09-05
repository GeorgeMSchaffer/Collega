using System.Text.Json;
using Collega.Application.Ai;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;

namespace Collega.Infrastructure.Ai;

/// <summary>
/// Builds the response JSON Schema <b>per request</b> from the retrieval result
/// (SPEC/20-feature-ai-idea-assist.md rules 15–18).
/// </summary>
/// <remarks>
/// <para><b>This is the containment mechanism.</b> Because <c>ideaTypeId</c> and <c>businessImpactId</c>
/// are <c>enum</c>s of this organization's real, active option ids, an invalid or cross-org
/// classification is <i>structurally impossible</i> — not prompt-discouraged. Rule 13 forbids
/// restating that guarantee as "the retrieved context will keep it on topic", and rule 16 forbids
/// substituting prompt instructions for it. If you are tempted to relax a constraint here, the
/// feature's security argument relaxes with it.</para>
///
/// <para><c>additionalProperties</c> is false and every enum is closed, so <c>nextQuestion</c> is the
/// only string the model can author. There is no field in which a limerick, a recipe, or a
/// general-knowledge answer could be returned.</para>
/// </remarks>
internal static class IdeaDraftSchema
{
    /// <summary>
    /// A per-request schema whose option enums are exactly the ids in <paramref name="context"/>.
    /// </summary>
    public static Dictionary<string, JsonElement> Build(IdeaAssistContext context)
    {
        var properties = new Dictionary<string, object>
        {
            ["inScope"] = new
            {
                type = "boolean",
                description =
                    "True when the user's latest message could plausibly become an idea of one of this "
                    + "organization's active idea types, within any scope statement given. False otherwise.",
            },
            ["nextQuestion"] = new
            {
                type = "string",
                description =
                    "One short follow-up question that moves the draft forward. This is the only free "
                    + "text you may write.",
            },
            ["title"] = Nullable(new { type = "string", maxLength = Idea.TitleMaxLength }),
            ["description"] = Nullable(new { type = "string", maxLength = Idea.DescriptionMaxLength }),
            ["ideaTypeId"] = NullableEnum(context.IdeaTypeIds, "The idea type, chosen from this organization's active types."),
            ["businessImpactId"] = NullableEnum(context.BusinessImpactIds, "The business impact, chosen from this organization's active options."),
            ["priority"] = new
            {
                anyOf = new object[]
                {
                    new { type = "string", @enum = Enum.GetNames<Priority>() },
                    new { type = "null" },
                },
            },
        };

        var schema = new
        {
            type = "object",
            properties,
            // inScope and nextQuestion are always required; the draft fields stay optional because an
            // early turn legitimately proposes nothing but a question (rule 19).
            required = new[] { "inScope", "nextQuestion" },
            additionalProperties = false,
        };

        return JsonSerializer
            .Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(schema))!;
    }

    /// <summary>
    /// A closed enum of the retrieved ids, or a bare null type when the organization has none — an
    /// empty <c>enum</c> array is not valid JSON Schema, and "no options" must still be expressible.
    /// </summary>
    private static object NullableEnum(IReadOnlyList<Guid> ids, string description)
    {
        if (ids.Count == 0)
        {
            return new { type = "null", description };
        }

        return new
        {
            description,
            anyOf = new object[]
            {
                new { type = "string", @enum = ids.Select(id => id.ToString()).ToArray() },
                new { type = "null" },
            },
        };
    }

    private static object Nullable(object constrained) => new
    {
        anyOf = new[] { constrained, new { type = "null" } },
    };
}
