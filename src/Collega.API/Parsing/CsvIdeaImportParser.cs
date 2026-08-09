using Collega.Application.Exceptions;
using Collega.Application.Ideas;

namespace Collega.API.Parsing;

/// <summary>
/// Parses an uploaded idea-import CSV into <see cref="IdeaImportRow"/> values (T059/T060). Columns are
/// located by header name (case-insensitive) so order is flexible, and every cell is exposed keyed by
/// its lowercased header — the service reads the core columns and any per-UDF-field columns from the
/// same map. Quote-aware parsing (see <see cref="Csv"/>) preserves commas inside descriptions/tags.
/// A missing/empty file, or a header missing the required columns, is a malformed request (400);
/// individual bad-data rows are reported per-row by the service.
/// </summary>
public static class CsvIdeaImportParser
{
    public static IReadOnlyList<IdeaImportRow> Parse(string content)
    {
        var records = Csv.Parse(content);

        var headerIndex = -1;
        for (var i = 0; i < records.Count; i++)
        {
            if (records[i].Any(c => !string.IsNullOrWhiteSpace(c)))
            {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex < 0)
        {
            throw new ValidationAppException("csvFile", new[] { "The CSV file is empty." });
        }

        var headers = records[headerIndex].Select(h => h.Trim().ToLowerInvariant()).ToList();
        var missing = IdeaCsvColumns.RequiredKeys.Where(k => !headers.Contains(k)).ToList();
        if (missing.Count > 0)
        {
            throw new ValidationAppException("csvFile", new[]
            {
                $"The CSV must have these columns: {string.Join(", ", IdeaCsvColumns.RequiredKeys)}."
            });
        }

        var rows = new List<IdeaImportRow>();
        var rowNumber = 0;
        for (var i = headerIndex + 1; i < records.Count; i++)
        {
            var record = records[i];
            if (record.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            rowNumber++;
            var cells = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            for (var col = 0; col < headers.Count; col++)
            {
                // Last column with a duplicated header wins; unmapped extra cells are ignored.
                cells[headers[col]] = col < record.Count ? record[col].Trim() : null;
            }

            rows.Add(new IdeaImportRow(rowNumber, cells));
        }

        return rows;
    }
}
