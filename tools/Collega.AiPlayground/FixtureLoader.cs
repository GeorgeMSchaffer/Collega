using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Collega.Application.Ai;

namespace Collega.AiPlayground;

/// <summary>Loads fixtures and cases from disk and turns fixtures into real contexts.</summary>
public static class FixtureLoader
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>
    /// Resolves a path against the working directory, then against the build output. Without the
    /// second attempt, <c>dotnet run --project tools/...</c> from the repo root fails to find
    /// <c>fixtures/</c>, because the working directory is the shell's, not the project's.
    /// </summary>
    public static string ResolvePath(string path)
    {
        if (Directory.Exists(path) || File.Exists(path))
        {
            return path;
        }

        var beside = Path.Combine(AppContext.BaseDirectory, path);
        if (Directory.Exists(beside) || File.Exists(beside))
        {
            return beside;
        }

        throw new DirectoryNotFoundException(
            $"'{path}' not found, and no '{path}' beside the binary at '{AppContext.BaseDirectory}'.");
    }

    public static IReadOnlyDictionary<string, IdeaAssistContext> LoadFixtures(string directory)
    {
        directory = ResolvePath(directory);
        var contexts = new Dictionary<string, IdeaAssistContext>(StringComparer.OrdinalIgnoreCase);

        foreach (var path in Directory.EnumerateFiles(directory, "*.json").OrderBy(p => p))
        {
            var fixture = Read<FixtureFile>(path);
            var name = string.IsNullOrWhiteSpace(fixture.Name)
                ? Path.GetFileNameWithoutExtension(path)
                : fixture.Name;

            contexts[name] = ToContext(fixture);
        }

        if (contexts.Count == 0)
        {
            throw new InvalidOperationException($"No fixtures found in '{directory}'.");
        }

        return contexts;
    }

    public static IReadOnlyList<CaseFile> LoadCases(string path)
    {
        path = ResolvePath(path);
        var files = File.Exists(path)
            ? new[] { path }
            : Directory.EnumerateFiles(path, "*.json", SearchOption.AllDirectories).OrderBy(p => p).ToArray();

        var cases = files.Select(Read<CaseFile>).ToList();

        foreach (var (id, count) in cases.GroupBy(c => c.Id).Select(g => (g.Key, g.Count())))
        {
            // Duplicate ids would silently merge in the report and make a comparison wrong rather than
            // noisy, so refuse rather than dedupe.
            if (count > 1)
            {
                throw new InvalidOperationException($"Duplicate case id '{id}' ({count} files).");
            }
        }

        if (cases.Count == 0)
        {
            throw new InvalidOperationException($"No cases found at '{path}'.");
        }

        return cases;
    }

    public static IdeaAssistContext ToContext(FixtureFile fixture) => new(
        OrganizationId: StableGuid($"org:{fixture.OrganizationName}"),
        OrganizationName: fixture.OrganizationName,
        ScopeStatement: string.IsNullOrWhiteSpace(fixture.ScopeStatement) ? null : fixture.ScopeStatement,
        IdeaTypes: fixture.IdeaTypes.Select(ToOption).ToList(),
        BusinessImpacts: fixture.BusinessImpacts.Select(ToOption).ToList(),
        Statuses: fixture.Statuses,
        Tags: fixture.Tags,
        MemberNames: fixture.MemberNames);

    private static IdeaAssistOption ToOption(FixtureOption option) =>
        new(option.Id ?? StableGuid(option.Name), option.Name, null, option.FieldNames);

    /// <summary>
    /// A GUID derived from the name, so ids stay identical across runs and machines without anyone
    /// hand-writing them. Not security-relevant — MD5 is used purely as a 128-bit digest of a name.
    /// </summary>
    private static Guid StableGuid(string name) =>
        new(MD5.HashData(Encoding.UTF8.GetBytes(name)));

    private static T Read<T>(string path)
    {
        try
        {
            return JsonSerializer.Deserialize<T>(File.ReadAllText(path), Json)
                ?? throw new InvalidOperationException($"'{path}' deserialized to null.");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"'{path}' is not valid JSON: {ex.Message}", ex);
        }
    }
}
