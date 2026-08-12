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

        // Line endings are resolved inside the state machine rather than by normalising the whole
        // document up front. A blanket Replace("\r\n", "\n") also rewrites the CRLFs *inside* quoted
        // fields, so a multi-line idea description exported and re-imported came back with its line
        // endings silently changed — the round trip Write/Parse documents as lossless was not.
        var text = content;
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
                    // Verbatim, including CR and LF: inside quotes they are content, not structure.
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
                case '\r':
                case '\n':
                    // Outside quotes any of CRLF / CR / LF terminates the record; consume the LF of a
                    // CRLF pair so it doesn't open a second, empty one.
                    if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
                    {
                        i++;
                    }

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

    /// <summary>
    /// True when the cell is either dangerous (a spreadsheet would evaluate it) or ambiguous (it
    /// already looks like a guarded cell, so an unguarded write would be misread on the way back
    /// in). Both cases are answered by skipping any leading apostrophes and testing the first
    /// character that isn't one: <c>=1+1</c>, <c>'=1+1</c>, and <c>''=1+1</c> all qualify, while
    /// <c>'tis</c>, <c>''</c>, and <c>plain</c> do not.
    /// </summary>
    /// <remarks>
    /// The apostrophe-counting matters for round-trip fidelity, not just for the leading case. A
    /// naive "is the first character a trigger" test writes <c>'=1+1</c> unguarded, and
    /// <see cref="StripFormulaGuard"/> then eats the user's own apostrophe on re-import, silently
    /// changing stored data. Guarding by depth makes escape/strip exact inverses at every level.
    /// </remarks>
    private static bool NeedsFormulaGuard(string value)
    {
        var i = 0;
        while (i < value.Length && value[i] == FormulaGuard)
        {
            i++;
        }

        return i < value.Length && Array.IndexOf(FormulaTriggers, value[i]) >= 0;
    }

    /// <summary>
    /// Exact inverse of the guard <see cref="Escape"/> applies: removes one leading apostrophe, and
    /// only when what remains would itself have been guarded on write. A field that genuinely
    /// starts with an apostrophe (<c>'tis</c>, <c>''</c>) is left untouched.
    /// </summary>
    private static string StripFormulaGuard(string field) =>
        field.Length > 0 && field[0] == FormulaGuard && NeedsFormulaGuard(field[1..])
            ? field[1..]
            : field;
}
