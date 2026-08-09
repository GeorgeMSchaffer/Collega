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
