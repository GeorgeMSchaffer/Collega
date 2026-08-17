using System.Text.Json;
using Collega.AiPlayground;
using Collega.Application.Ai;
using Collega.Infrastructure.Ai;

// Prompt playground for AI idea assist. Makes REAL, BILLED calls — see tools/README.md.
//
//   dump-prompt --fixture acme > prompts/baseline.md
//   run --cases cases/ [--prompt prompts/variant-a.md] [--repeat 3] [--max-spend 1.00] [--json out.json]
//   compare runs/baseline.json runs/variant-a.json

var options = CommandLine.Parse(args);

try
{
    return options.Command switch
    {
        "dump-prompt" => DumpPrompt(options),
        "run" => await RunAsync(options),
        "compare" => Compare(options),
        _ => Usage(),
    };
}
catch (Exception ex)
{
    Console.Error.WriteLine($"error: {ex.Message}");
    return 1;
}

static int Usage()
{
    Console.Error.WriteLine("""
        Collega AI prompt playground — makes real, billed model calls.

          dump-prompt --fixture <name>
              Render the real compiled system prompt. Redirect it to a file and edit that file
              to create a variant.

          run --cases <dir|file> [--fixtures <dir>] [--prompt <file>] [--repeat N]
              [--max-spend USD] [--json <file>]
              Run every case and score it. --prompt substitutes a prompt for the compiled one.

          compare <baseline.json> <variant.json>
              Per-dimension delta between two runs.

        The API key is read from Ai__ApiKey, or ANTHROPIC_API_KEY.
        """);

    return 2;
}

static AiUsageLimits Limits() => new();

static IdeaAssistContext Fixture(CommandLine options, out IReadOnlyDictionary<string, IdeaAssistContext> all)
{
    all = FixtureLoader.LoadFixtures(options.FixturesDirectory);

    var name = options.Fixture ?? all.Keys.First();
    if (!all.TryGetValue(name, out var context))
    {
        throw new InvalidOperationException($"No fixture '{name}'. Known: {string.Join(", ", all.Keys)}");
    }

    return context;
}

static int DumpPrompt(CommandLine options)
{
    var context = Fixture(options, out _);
    Console.Out.Write(IdeaAssistPromptBuilder.BuildSystemPrompt(context));
    return 0;
}

static string RequireApiKey()
{
    var key = Environment.GetEnvironmentVariable("Ai__ApiKey")
        ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");

    if (string.IsNullOrWhiteSpace(key))
    {
        throw new InvalidOperationException(
            "No API key. Set one for this shell:\n\n    export Ai__ApiKey='<key>'\n");
    }

    return key;
}

static async Task<int> RunAsync(CommandLine options)
{
    var limits = Limits();
    var context = Fixture(options, out var fixtures);
    _ = context;

    var cases = FixtureLoader.LoadCases(options.CasesPath
        ?? throw new InvalidOperationException("--cases is required."));

    // The prompt override is the whole point of the tool: production keeps its prompt in
    // IdeaAssistPromptBuilder, and this substitutes a file for measurement only.
    Func<IdeaAssistContext, string>? promptFactory = null;
    var promptLabel = "compiled";

    if (options.PromptFile is { Length: > 0 } promptPath)
    {
        var text = File.ReadAllText(promptPath);
        promptFactory = _ => text;
        promptLabel = Path.GetFileName(promptPath);

        Console.Error.WriteLine(
            $"note: using prompt from '{promptPath}'. It is static, so the organization catalog is "
            + "whatever that file contains — dump-prompt first if you want the real catalog in it.");
    }

    var totalCalls = cases.Sum(c => c.Turns.Count) * options.Repeat;
    var estimate = totalCalls * 0.004m;

    Console.Error.WriteLine(
        $"{cases.Count} case(s) x {options.Repeat} = {totalCalls} billed call(s), roughly ${estimate:0.00}.");

    if (options.MaxSpend is { } ceiling && estimate > ceiling)
    {
        throw new InvalidOperationException(
            $"estimated ${estimate:0.00} exceeds --max-spend ${ceiling:0.00}. Lower --repeat or raise the ceiling.");
    }

    if (!options.Yes && !Confirm())
    {
        Console.Error.WriteLine("aborted.");
        return 130;
    }

    var model = new AnthropicIdeaDraftModel(limits, new AiCredentials { ApiKey = RequireApiKey() }, promptFactory);
    var runner = new CaseRunner(model, fixtures);
    var attempts = new List<AttemptResult>();
    var spent = 0m;

    for (var attempt = 1; attempt <= options.Repeat; attempt++)
    {
        foreach (var testCase in cases)
        {
            var result = await runner.RunAsync(testCase, attempt);
            attempts.Add(result);

            spent += (result.InputTokens / 1_000_000m * limits.InputRatePerMillion)
                   + (result.OutputTokens / 1_000_000m * limits.OutputRatePerMillion);

            Console.Error.Write($"\r{attempts.Count}/{cases.Count * options.Repeat}  ${spent:0.0000}   ");

            // Enforced mid-sweep, not at the end: a ceiling you only discover you crossed after
            // spending is not a ceiling.
            if (options.MaxSpend is { } cap && spent > cap)
            {
                Console.Error.WriteLine($"\n--max-spend ${cap:0.00} reached after {attempts.Count} call(s). Stopping.");
                break;
            }
        }

        if (options.MaxSpend is { } outer && spent > outer)
        {
            break;
        }
    }

    Console.Error.WriteLine();

    var report = new RunReport(promptLabel, limits.Model, limits.Effort, options.Repeat, attempts);
    Reporter.PrintRun(report, limits, Console.Out);

    if (options.JsonOut is { Length: > 0 } jsonPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(jsonPath))!);
        File.WriteAllText(jsonPath, JsonSerializer.Serialize(report, new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            WriteIndented = true,
        }));

        Console.Error.WriteLine($"wrote {jsonPath}");
    }

    // Non-zero when anything failed, so this can gate a manual check without reading the table.
    var cacheOk = report.Attempts.Count(a => !a.Errored) < 2 || report.Attempts.Sum(a => (long)a.CacheReadTokens) > 0;
    return attempts.All(a => a.Passed) && cacheOk ? 0 : 1;
}

static bool Confirm()
{
    Console.Error.Write("proceed? [y/N] ");
    var answer = Console.ReadLine();
    return string.Equals(answer?.Trim(), "y", StringComparison.OrdinalIgnoreCase);
}

static int Compare(CommandLine options)
{
    if (options.Positional.Count < 2)
    {
        throw new InvalidOperationException("compare needs two run files.");
    }

    var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
    var baseline = JsonSerializer.Deserialize<RunReport>(File.ReadAllText(options.Positional[0]), json)!;
    var variant = JsonSerializer.Deserialize<RunReport>(File.ReadAllText(options.Positional[1]), json)!;

    Reporter.PrintComparison(baseline, variant, Limits(), Console.Out);
    return 0;
}
