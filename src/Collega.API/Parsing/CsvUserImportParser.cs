using Collega.Application.Exceptions;
using Collega.Application.Users;

namespace Collega.API.Parsing;

/// <summary>
/// Parses the uploaded user-import CSV into <see cref="UserImportRow"/> values (SPEC/30-Contracts.md
/// user import). Columns are located by header name (<c>firstName</c>, <c>lastName</c>, <c>email</c>,
/// optional <c>role</c>) so column order is flexible. A missing/empty file or a header without the
/// required columns is a malformed request (400); individual bad data rows are handled downstream.
/// This is a deliberately minimal comma-splitter — it does not support quoted fields with embedded
/// commas or newlines.
/// </summary>
public static class CsvUserImportParser
{
    public static IReadOnlyList<UserImportRow> Parse(string content)
    {
        var lines = (content ?? string.Empty).Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');

        var headerIndex = Array.FindIndex(lines, l => !string.IsNullOrWhiteSpace(l));
        if (headerIndex < 0)
        {
            throw new ValidationAppException("csvFile", new[] { "The CSV file is empty." });
        }

        var header = lines[headerIndex].Split(',').Select(h => h.Trim().ToLowerInvariant()).ToList();
        var firstIdx = header.IndexOf("firstname");
        var lastIdx = header.IndexOf("lastname");
        var emailIdx = header.IndexOf("email");
        var roleIdx = header.IndexOf("role");

        if (firstIdx < 0 || lastIdx < 0 || emailIdx < 0)
        {
            throw new ValidationAppException("csvFile", new[] { "The CSV must have firstName, lastName, and email columns." });
        }

        var rows = new List<UserImportRow>();
        var rowNumber = 0;
        for (var i = headerIndex + 1; i < lines.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i]))
            {
                continue;
            }

            var cells = lines[i].Split(',');
            rowNumber++;

            string? Cell(int idx) => idx >= 0 && idx < cells.Length ? cells[idx].Trim() : null;

            rows.Add(new UserImportRow(rowNumber, Cell(firstIdx), Cell(lastIdx), Cell(emailIdx), Cell(roleIdx)));
        }

        return rows;
    }
}
