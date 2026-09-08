using System.Text;
using Collega.Application.Ai;

namespace Collega.AiPlayground;

/// <summary>Renders a sweep as a table, and two sweeps as a delta.</summary>
public static class Reporter
{
    private static readonly Dimension[] Columns =
    {
        Dimension.Scope, Dimension.IdeaType, Dimension.BusinessImpact, Dimension.Priority, Dimension.Fields,
    };

    public static void PrintRun(RunReport report, AiUsageLimits limits, TextWriter output)
    {
        var byCase = report.Attempts.GroupBy(a => a.CaseId).ToList();
        var table = new StringBuilder();

        table.AppendLine();
        table.Append("CASE".PadRight(28));
        foreach (var column in Columns)
        {
            table.Append(Header(column).PadLeft(9));
        }

        table.Append("$/turn".PadLeft(10)).AppendLine();
        table.AppendLine(new string('-', 28 + (Columns.Length * 9) + 10));

        foreach (var group in byCase.OrderBy(g => g.Key, StringComparer.Ordinal))
        {
            var attempts = group.ToList();
            table.Append(Truncate(group.Key, 27).PadRight(28));

            foreach (var column in Columns)
            {
                var scored = attempts
                    .Where(a => !a.Errored && a.Dimensions.Any(d => d.Dimension == column))
                    .ToList();

                if (scored.Count == 0)
                {
                    table.Append("-".PadLeft(9));
                    continue;
                }

                var passed = scored.Count(a => a.Dimensions.First(d => d.Dimension == column).Passed);
                table.Append($"{passed}/{scored.Count}".PadLeft(9));
            }

            var turns = attempts.Sum(a => a.Turns == 0 ? 1 : a.Turns);
            var cost = attempts.Sum(a => Cost(a, limits));
            table.Append((turns == 0 ? 0m : cost / turns).ToString("0.0000").PadLeft(10));

            var errors = attempts.Count(a => a.Errored);
            if (errors > 0)
            {
                table.Append($"  ERROR x{errors}");
            }
            else if (Columns.Any(c => IsFlaky(attempts, c)))
            {
                table.Append("  <- flaky");
            }

            table.AppendLine();
        }

        output.Write(table.ToString());
        output.WriteLine();

        foreach (var column in Columns)
        {
            var scored = report.Attempts.Where(a => !a.Errored && a.Dimensions.Any(d => d.Dimension == column)).ToList();
            if (scored.Count == 0)
            {
                continue;
            }

            var passed = scored.Count(a => a.Dimensions.First(d => d.Dimension == column).Passed);
            output.Write($"{Header(column).ToLowerInvariant()} {passed}/{scored.Count}   ");
        }

        output.WriteLine();
        PrintCacheVerdict(report, output);
        output.WriteLine(
            $"prompt '{report.PromptLabel}'   {report.Model} / effort {report.Effort}   "
            + $"repeat {report.Repeat}   total ${report.CostUsd(limits.InputRatePerMillion, limits.OutputRatePerMillion):0.0000}");

        foreach (var failure in report.Attempts.Where(a => a.Errored || !a.Passed))
        {
            var detail = failure.Errored
                ? failure.Error
                : string.Join("; ", failure.Dimensions.Where(d => !d.Passed).Select(d => $"{d.Dimension}: {d.Detail}"));

            output.WriteLine($"  {failure.CaseId} #{failure.Attempt}: {detail}");
        }
    }

    /// <summary>
    /// The check nothing else performs. The system prompt is the cached stable prefix; if anything
    /// per-request leaks into it, cache reads go to zero and every turn silently costs roughly double
    /// while producing identical-looking output. Only meaningful once a prefix has been written, so
    /// the very first call of a sweep is excluded.
    /// </summary>
    public static bool PrintCacheVerdict(RunReport report, TextWriter output)
    {
        var callable = report.Attempts.Where(a => !a.Errored).ToList();
        if (callable.Count < 2)
        {
            output.WriteLine("cache: not enough calls to judge");
            return true;
        }

        var totalRead = callable.Sum(a => (long)a.CacheReadTokens);
        var totalTurns = callable.Sum(a => a.Turns == 0 ? 1 : a.Turns);
        var perTurn = totalTurns == 0 ? 0 : totalRead / totalTurns;

        if (totalRead == 0)
        {
            output.WriteLine(
                "cache: *** ZERO READS — the stable prefix is broken. Something per-request has leaked "
                + "into the system prompt; this roughly doubles cost per turn. ***");
            return false;
        }

        output.WriteLine($"cache read {perTurn} tok/turn (hit)");
        return true;
    }

    public static void PrintComparison(RunReport baseline, RunReport variant, AiUsageLimits limits, TextWriter output)
    {
        output.WriteLine();
        output.WriteLine($"baseline: '{baseline.PromptLabel}'   variant: '{variant.PromptLabel}'");
        output.WriteLine();
        output.WriteLine("DIMENSION".PadRight(18) + "BASELINE".PadLeft(12) + "VARIANT".PadLeft(12) + "   DELTA");
        output.WriteLine(new string('-', 60));

        var regressed = false;

        foreach (var column in Columns)
        {
            var (basePassed, baseTotal) = Rate(baseline, column);
            var (varPassed, varTotal) = Rate(variant, column);

            if (baseTotal == 0 && varTotal == 0)
            {
                continue;
            }

            var baseRate = baseTotal == 0 ? 0d : (double)basePassed / baseTotal;
            var varRate = varTotal == 0 ? 0d : (double)varPassed / varTotal;
            var delta = varRate - baseRate;

            if (delta < 0)
            {
                regressed = true;
            }

            output.WriteLine(
                Header(column).PadRight(18)
                + $"{basePassed}/{baseTotal}".PadLeft(12)
                + $"{varPassed}/{varTotal}".PadLeft(12)
                + $"   {(delta >= 0 ? "+" : "")}{delta:P0}{(delta < 0 ? "  <- WORSE" : "")}");
        }

        var baseCost = baseline.CostUsd(limits.InputRatePerMillion, limits.OutputRatePerMillion);
        var varCost = variant.CostUsd(limits.InputRatePerMillion, limits.OutputRatePerMillion);

        output.WriteLine();
        output.WriteLine($"cost   ${baseCost:0.0000} -> ${varCost:0.0000}   ({(varCost >= baseCost ? "+" : "")}{varCost - baseCost:0.0000})");
        output.WriteLine();
        output.WriteLine(regressed
            ? "VERDICT: the variant is worse on at least one dimension."
            : "VERDICT: no dimension regressed.");
    }

    private static (int Passed, int Total) Rate(RunReport report, Dimension dimension)
    {
        var scored = report.Attempts.Where(a => !a.Errored && a.Dimensions.Any(d => d.Dimension == dimension)).ToList();
        return (scored.Count(a => a.Dimensions.First(d => d.Dimension == dimension).Passed), scored.Count);
    }

    private static bool IsFlaky(IReadOnlyList<AttemptResult> attempts, Dimension dimension)
    {
        var scored = attempts.Where(a => !a.Errored && a.Dimensions.Any(d => d.Dimension == dimension)).ToList();
        if (scored.Count < 2)
        {
            return false;
        }

        var passed = scored.Count(a => a.Dimensions.First(d => d.Dimension == dimension).Passed);
        return passed > 0 && passed < scored.Count;
    }

    private static decimal Cost(AttemptResult attempt, AiUsageLimits limits) =>
        (attempt.InputTokens / 1_000_000m * limits.InputRatePerMillion)
        + (attempt.OutputTokens / 1_000_000m * limits.OutputRatePerMillion);

    private static string Header(Dimension dimension) => dimension switch
    {
        Dimension.Scope => "SCOPE",
        Dimension.IdeaType => "TYPE",
        Dimension.BusinessImpact => "IMPACT",
        Dimension.Priority => "PRIORITY",
        _ => "FIELDS",
    };

    private static string Truncate(string value, int length) =>
        value.Length <= length ? value : value[..(length - 1)] + "…";
}
