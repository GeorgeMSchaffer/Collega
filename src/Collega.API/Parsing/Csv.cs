using System.Text;

namespace Collega.API.Parsing;

/// <summary>
/// Minimal RFC 4180-style CSV reader/writer used by the idea import/export (T059/T060). Unlike the
/// legacy user-import splitter, this handles quoted fields with embedded commas, escaped quotes
/// (<c>""</c>), and embedded newlines — idea descriptions routinely contain commas, so a naive split
/// would corrupt them. Fields are quoted on write only when they contain a comma, quote, or newline.
///
/// <para><b>Formula injection (CWE-1236).</b> Spreadsheet applications evaluate a cell whose text
/// begins with <c>=</c>, <c>+</c>, <c>-</c>, <c>@</c>, tab, or CR as a formula when the file is
/// opened, so user-authored content exported verbatim can execute in the reader's spreadsheet (a
/// <c>=HYPERLINK(...)</c> exfiltration or a DDE payload). <see cref="Write"/> prefixes a guard
/// apostrophe on such cells, and <see cref="Parse"/> strips the same guard, so Write/Parse remain a
/// lossless pair and an export → edit → re-import round trip is unchanged.</para>
/// </summary>
public static class Csv
{
    /// <summary>Leading characters that make a spreadsheet treat a cell as a formula.</summary>
    private static readonly char[] FormulaTriggers = { '=', '+', '-', '@', '\t', '\r' };

    /// <summary>Characters that force RFC 4180 quoting.</summary>
    private static readonly char[] QuoteTriggers = { ',', '"', '\n', '\r' };

    private const char FormulaGuard = '\'';

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
                    record.Add(StripFormulaGuard(field.ToString()));
                    field.Clear();
                    sawAny = true;
                    break;
                case '\n':
                    record.Add(StripFormulaGuard(field.ToString()));
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
            record.Add(StripFormulaGuard(field.ToString()));
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

        // Guard before quoting: the apostrophe becomes part of the cell text, so it must be inside
        // the quotes when the value also needs quoting.
        if (NeedsFormulaGuard(value))
        {
            value = FormulaGuard + value;
        }

        if (value.IndexOfAny(QuoteTriggers) < 0)
        {
            return value;
        }

        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    private static bool NeedsFormulaGuard(string value) =>
        value.Length > 0 && Array.IndexOf(FormulaTriggers, value[0]) >= 0;

    /// <summary>
    /// Removes the guard apostrophe <see cref="Escape"/> adds, and only that: a leading apostrophe
    /// is stripped solely when the next character is itself a formula trigger. A field that
    /// genuinely starts with an apostrophe (<c>'tis</c>) is left untouched.
    /// </summary>
    private static string StripFormulaGuard(string field) =>
        field.Length >= 2 && field[0] == FormulaGuard && Array.IndexOf(FormulaTriggers, field[1]) >= 0
            ? field[1..]
            : field;
}
