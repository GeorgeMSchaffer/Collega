namespace Collega.AiPlayground;

/// <summary>
/// Minimal argument parsing. Hand-rolled rather than adding a package: the repo requires approval for
/// new NuGet references, and this is three commands with six flags.
/// </summary>
public sealed class CommandLine
{
    public string Command { get; private init; } = "";
    public string? CasesPath { get; private init; }
    public string FixturesDirectory { get; private init; } = "fixtures";
    public string? Fixture { get; private init; }
    public string? PromptFile { get; private init; }
    public string? JsonOut { get; private init; }
    public int Repeat { get; private init; } = 1;
    public decimal? MaxSpend { get; private init; }
    public bool Yes { get; private init; }
    public IReadOnlyList<string> Positional { get; private init; } = Array.Empty<string>();

    public static CommandLine Parse(string[] args)
    {
        if (args.Length == 0)
        {
            return new CommandLine();
        }

        string? cases = null, fixture = null, prompt = null, jsonOut = null;
        var fixtures = "fixtures";
        var repeat = 1;
        decimal? maxSpend = null;
        var yes = false;
        var positional = new List<string>();

        for (var i = 1; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--cases":
                    cases = Next(args, ref i);
                    break;
                case "--fixtures":
                    fixtures = Next(args, ref i);
                    break;
                case "--fixture":
                    fixture = Next(args, ref i);
                    break;
                case "--prompt":
                    prompt = Next(args, ref i);
                    break;
                case "--json":
                    jsonOut = Next(args, ref i);
                    break;
                case "--repeat":
                    repeat = int.Parse(Next(args, ref i));
                    break;
                case "--max-spend":
                    maxSpend = decimal.Parse(Next(args, ref i));
                    break;
                case "-y":
                case "--yes":
                    yes = true;
                    break;
                default:
                    if (args[i].StartsWith('-'))
                    {
                        throw new InvalidOperationException($"unknown flag '{args[i]}'");
                    }

                    positional.Add(args[i]);
                    break;
            }
        }

        if (repeat < 1)
        {
            throw new InvalidOperationException("--repeat must be at least 1.");
        }

        return new CommandLine
        {
            Command = args[0],
            CasesPath = cases,
            FixturesDirectory = fixtures,
            Fixture = fixture,
            PromptFile = prompt,
            JsonOut = jsonOut,
            Repeat = repeat,
            MaxSpend = maxSpend,
            Yes = yes,
            Positional = positional,
        };
    }

    private static string Next(string[] args, ref int index)
    {
        if (index + 1 >= args.Length)
        {
            throw new InvalidOperationException($"'{args[index]}' needs a value.");
        }

        return args[++index];
    }
}
