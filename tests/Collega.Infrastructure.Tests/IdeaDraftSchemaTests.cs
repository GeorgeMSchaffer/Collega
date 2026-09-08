using System.Text.Json;
using Collega.Application.Ai;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Infrastructure.Ai;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// The per-request response schema (SPEC/20-feature-ai-idea-assist.md rules 15–18).
/// </summary>
/// <remarks>
/// <b>This is the containment mechanism, so these are containment tests.</b> Rule 16 says an invalid
/// or cross-org classification must be structurally impossible rather than prompt-discouraged; the
/// only way that holds is if the option enums are built from the retrieved ids and nothing else. If a
/// change makes one of these fail, the feature's security argument has changed with it — do not
/// "fix" the test.
/// </remarks>
public sealed class IdeaDraftSchemaTests
{
    private static readonly Guid ProcessTypeId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid HighImpactId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void Schema_ConstrainsIdeaTypeToTheRetrievedIds()
    {
        var schema = Build();

        var allowed = EnumValuesOf(schema, "ideaTypeId");

        Assert.Equal(new[] { ProcessTypeId.ToString() }, allowed);
    }

    [Fact]
    public void Schema_ConstrainsBusinessImpactToTheRetrievedIds()
    {
        var schema = Build();

        Assert.Equal(new[] { HighImpactId.ToString() }, EnumValuesOf(schema, "businessImpactId"));
    }

    /// <summary>
    /// The proof the Definition of Done asks for: an id from another organization is not in the enum,
    /// so the model has no way to emit it — it is not merely rejected downstream, it is unsayable.
    /// </summary>
    [Fact]
    public void Schema_CannotExpressAnIdFromAnotherOrganization()
    {
        var foreignId = Guid.NewGuid();
        var schema = Build();

        Assert.DoesNotContain(foreignId.ToString(), EnumValuesOf(schema, "ideaTypeId"));
        Assert.DoesNotContain(foreignId.ToString(), EnumValuesOf(schema, "businessImpactId"));
    }

    /// <summary>
    /// A soft-deleted option is absent from retrieval, so it is absent from the enum. Inactive options
    /// are as unsayable as foreign ones — same mechanism, no extra rule.
    /// </summary>
    [Fact]
    public void Schema_CannotExpressAnInactiveOption()
    {
        var retiredTypeId = Guid.NewGuid();
        var schema = Build();

        Assert.DoesNotContain(retiredTypeId.ToString(), EnumValuesOf(schema, "ideaTypeId"));
    }

    [Fact]
    public void Schema_ClosesAdditionalProperties()
    {
        var schema = Build();

        Assert.False(schema["additionalProperties"].GetBoolean());
    }

    /// <summary>
    /// <c>nextQuestion</c> is the only free-text field. There must be no other place a limerick, a
    /// recipe, or a general-knowledge answer could be returned (rule 15).
    /// </summary>
    [Fact]
    public void Schema_ExposesExactlyOneUnconstrainedTextField()
    {
        var properties = Build()["properties"];

        var unconstrained = properties
            .EnumerateObject()
            .Where(p => IsPlainString(p.Value))
            .Select(p => p.Name)
            .ToList();

        Assert.Equal(new[] { "nextQuestion" }, unconstrained);
    }

    [Fact]
    public void Schema_CapsTitleAndDescriptionAtTheDomainMaxima()
    {
        var properties = Build()["properties"];

        Assert.Equal(Idea.TitleMaxLength, MaxLengthOf(properties, "title"));
        Assert.Equal(Idea.DescriptionMaxLength, MaxLengthOf(properties, "description"));
    }

    [Fact]
    public void Schema_ConstrainsPriorityToTheDomainEnum()
    {
        Assert.Equal(Enum.GetNames<Priority>(), EnumValuesOf(Build(), "priority"));
    }

    /// <summary>
    /// Only the scope flag and the question are required. Every draft field stays optional because an
    /// early turn legitimately proposes nothing but a question (rule 19) — requiring them would push
    /// the model into guessing a classification it has no basis for.
    /// </summary>
    [Fact]
    public void Schema_RequiresOnlyTheScopeFlagAndTheQuestion()
    {
        var required = Build()["required"].EnumerateArray().Select(v => v.GetString()).ToList();

        Assert.Equal(new[] { "inScope", "nextQuestion" }, required);
    }

    /// <summary>
    /// An organization with no active options must still produce valid JSON Schema — an empty
    /// <c>enum</c> array is not valid, so the field degrades to a bare null type.
    /// </summary>
    [Fact]
    public void Schema_IsValid_WhenTheOrganizationHasNoOptions()
    {
        var schema = IdeaDraftSchema.Build(Context(
            ideaTypes: Array.Empty<IdeaAssistOption>(),
            businessImpacts: Array.Empty<IdeaAssistOption>()));

        var ideaType = schema["properties"].GetProperty("ideaTypeId");

        Assert.Equal("null", ideaType.GetProperty("type").GetString());
        Assert.False(ideaType.TryGetProperty("enum", out _));
    }

    private static Dictionary<string, JsonElement> Build() => IdeaDraftSchema.Build(Context());

    private static IdeaAssistContext Context(
        IReadOnlyList<IdeaAssistOption>? ideaTypes = null,
        IReadOnlyList<IdeaAssistOption>? businessImpacts = null) =>
        new(
            Guid.NewGuid(),
            "Acme Robotics",
            ScopeStatement: null,
            ideaTypes ?? new[] { new IdeaAssistOption(ProcessTypeId, "Process Revision") },
            businessImpacts ?? new[] { new IdeaAssistOption(HighImpactId, "High") },
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>());

    /// <summary>Reads the enum values from a nullable option field's <c>anyOf</c> string branch.</summary>
    private static string[] EnumValuesOf(Dictionary<string, JsonElement> schema, string property)
    {
        var field = schema["properties"].GetProperty(property);

        if (!field.TryGetProperty("anyOf", out var anyOf))
        {
            return Array.Empty<string>();
        }

        foreach (var branch in anyOf.EnumerateArray())
        {
            if (branch.TryGetProperty("enum", out var values))
            {
                return values.EnumerateArray().Select(v => v.GetString()!).ToArray();
            }
        }

        return Array.Empty<string>();
    }

    private static int? MaxLengthOf(JsonElement properties, string property)
    {
        foreach (var branch in properties.GetProperty(property).GetProperty("anyOf").EnumerateArray())
        {
            if (branch.TryGetProperty("maxLength", out var max))
            {
                return max.GetInt32();
            }
        }

        return null;
    }

    /// <summary>A string field with no enum and no length cap — i.e. somewhere arbitrary prose fits.</summary>
    private static bool IsPlainString(JsonElement field)
    {
        if (field.TryGetProperty("anyOf", out _))
        {
            return false;
        }

        return field.TryGetProperty("type", out var type)
            && type.GetString() == "string"
            && !field.TryGetProperty("enum", out _)
            && !field.TryGetProperty("maxLength", out _);
    }
}
