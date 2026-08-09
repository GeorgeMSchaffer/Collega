using System.Text;

namespace Collega.API.Parsing;

/// <summary>
/// Minimal RFC 4180-style CSV reader/writer used by the idea import/export (T059/T060). Unlike the
/// legacy user-import splitter, this handles quoted fields with embedded commas, escaped quotes
/// (<c>""</c>), and embedded newlines — idea descriptions routinely contain commas, so a naive split
/// would corrupt them. Fields are quoted on write only when they contain a comma, quote, or newline.
/// </summary>
public static class Csv
{
    /// <summary>Parses CSV text into records of raw field strings. A trailing newline does not produce
    /// an empty trailing record.</summary>
    public static IReadOnlyList<IReadOnlyList<string>> Parse(string? content)
    {
        var records = new List<IReadOnlyList<string>>();
        if (string.IsNullOrEmpty(content))
        {
            return records;
        }

        var text = content.Replace("\r\n", "\n").Replace("\r", "\n");
        var field = new StringBuilder();
        var record = new List<string>();
        var inQuotes = false;
        var sawAny = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        field.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    field.Append(c);
                }

                continue;
            }

            switch (c)
            {
                case '"':
                    inQuotes = true;
                    sawAny = true;
                    break;
                case ',':
                    record.Add(field.ToString());
                    field.Clear();
                    sawAny = true;
                    break;
                case '\n':
                    record.Add(field.ToString());
                    field.Clear();
                    records.Add(record);
                    record = new List<string>();
                    sawAny = false;
                    break;
                default:
                    field.Append(c);
                    sawAny = true;
                    break;
            }
        }

        // Flush a final record only if the last line carried content (no phantom trailing record).
        if (sawAny || field.Length > 0 || record.Count > 0)
        {
            record.Add(field.ToString());
            records.Add(record);
        }

        return records;
    }

    /// <summary>Serializes headers + rows to CRLF-terminated CSV text, quoting only where required.</summary>
    public static string Write(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<string>> rows)
    {
        var sb = new StringBuilder();
        AppendRow(sb, headers);
        foreach (var row in rows)
        {
            AppendRow(sb, row);
        }

        return sb.ToString();
    }

    private static void AppendRow(StringBuilder sb, IReadOnlyList<string> cells)
    {
        for (var i = 0; i < cells.Count; i++)
        {
            if (i > 0)
            {
                sb.Append(',');
            }

            sb.Append(Escape(cells[i]));
        }

        sb.Append("\r\n");
    }

    private static string Escape(string? value)
    {
        value ??= string.Empty;
        if (value.IndexOfAny(new[] { ',', '"', '\n', '\r' }) < 0)
        {
            return value;
        }

        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }
}
