using Collega.Application.Ai;

namespace Collega.AiPlayground;

/// <summary>
/// Turns a final model response into per-dimension pass/fail against a case's expectations.
/// </summary>
/// <remarks>
/// Only declared dimensions are scored. That matters most for refusal cases: a refused turn returns
/// the draft unchanged, so asserting a classification on one would either always fail or, worse,
/// accidentally pass because the draft was empty anyway.
/// </remarks>
public static class Scorer
{
    public static IReadOnlyList<DimensionResult> Score(
        CaseExpectation expect,
        IdeaDraftModelResponse response,
        IdeaDraft draft,
        IdeaAssistContext context)
    {
        var results = new List<DimensionResult>();

        if (expect.InScope is { } wantScope)
        {
            results.Add(new DimensionResult(
                Dimension.Scope,
                response.InScope == wantScope,
                response.InScope == wantScope ? null : $"expected inScope={wantScope}, got {response.InScope}"));
        }

        if (expect.IdeaType is { Length: > 0 } wantType)
        {
            results.Add(Compare(Dimension.IdeaType, wantType, NameOf(context.IdeaTypes, draft.IdeaTypeId)));
        }

        if (expect.BusinessImpact is { Length: > 0 } wantImpact)
        {
            results.Add(Compare(Dimension.BusinessImpact, wantImpact, NameOf(context.BusinessImpacts, draft.BusinessImpactId)));
        }

        if (expect.Priority is { Length: > 0 } wantPriority)
        {
            results.Add(Compare(Dimension.Priority, wantPriority, draft.Priority?.ToString()));
        }

        // Title and description are scored together as one "did it actually fill the form" signal —
        // they succeed and fail together in practice, and splitting them doubles the report width for
        // no extra diagnostic value.
        if (expect.TitleSet is { } wantTitle || expect.DescriptionSet is { } wantDescription)
        {
            var problems = new List<string>();

            if (expect.TitleSet is { } t && !string.IsNullOrWhiteSpace(draft.Title) != t)
            {
                problems.Add($"expected title{(t ? "" : " not")} set");
            }

            if (expect.DescriptionSet is { } d && !string.IsNullOrWhiteSpace(draft.Description) != d)
            {
                problems.Add($"expected description{(d ? "" : " not")} set");
            }

            results.Add(new DimensionResult(
                Dimension.Fields,
                problems.Count == 0,
                problems.Count == 0 ? null : string.Join("; ", problems)));
        }

        return results;
    }

    private static DimensionResult Compare(Dimension dimension, string expected, string? actual)
    {
        var passed = string.Equals(expected, actual, StringComparison.OrdinalIgnoreCase);
        return new DimensionResult(dimension, passed, passed ? null : $"expected '{expected}', got '{actual ?? "null"}'");
    }

    private static string? NameOf(IReadOnlyList<IdeaAssistOption> options, Guid? id) =>
        id is { } value ? options.FirstOrDefault(o => o.Id == value)?.Name : null;
}
