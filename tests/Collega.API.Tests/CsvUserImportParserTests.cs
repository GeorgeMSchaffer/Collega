using Collega.API.Parsing;
using Collega.Application.Exceptions;

namespace Collega.API.Tests;

/// <summary>
/// Unit coverage for <see cref="CsvUserImportParser"/> (T047-T049 hardening). Pure and hermetic —
/// no host, no database. Exercises header-name mapping (order-independent, case-insensitive),
/// cell trimming, the optional-role default, blank-line handling / row numbering, short rows, and
/// the malformed-input failures (empty file, missing required columns) that surface as a 400.
/// </summary>
public sealed class CsvUserImportParserTests
{
    [Fact]
    public void Parse_Maps_Columns_By_Header_Name_Regardless_Of_Order()
    {
        // Arrange: deliberately reorder columns and add an unrelated trailing column.
        const string csv =
            "email,role,lastName,firstName\n" +
            "ada@example.test,OrgAdmin,Lovelace,Ada\n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        var row = Assert.Single(rows);
        Assert.Equal(1, row.RowNumber);
        Assert.Equal("Ada", row.FirstName);
        Assert.Equal("Lovelace", row.LastName);
        Assert.Equal("ada@example.test", row.Email);
        Assert.Equal("OrgAdmin", row.Role);
    }

    [Fact]
    public void Parse_Matches_Header_Names_Case_Insensitively()
    {
        // Arrange: mixed-case / spaced headers must still map.
        const string csv =
            " FirstName , LASTNAME , Email \n" +
            "Grace,Hopper,grace@example.test\n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        var row = Assert.Single(rows);
        Assert.Equal("Grace", row.FirstName);
        Assert.Equal("Hopper", row.LastName);
        Assert.Equal("grace@example.test", row.Email);
    }

    [Fact]
    public void Parse_Trims_Surrounding_Whitespace_In_Cells()
    {
        // Arrange
        const string csv =
            "firstName,lastName,email,role\n" +
            "  Alan  ,  Turing  ,  alan@example.test  ,  User  \n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        var row = Assert.Single(rows);
        Assert.Equal("Alan", row.FirstName);
        Assert.Equal("Turing", row.LastName);
        Assert.Equal("alan@example.test", row.Email);
        Assert.Equal("User", row.Role);
    }

    [Fact]
    public void Parse_Leaves_Role_Null_When_Column_Absent()
    {
        // Arrange: role is optional; the import service defaults a null role to "User".
        const string csv =
            "firstName,lastName,email\n" +
            "Edsger,Dijkstra,edsger@example.test\n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        var row = Assert.Single(rows);
        Assert.Null(row.Role);
    }

    [Fact]
    public void Parse_Numbers_Data_Rows_Sequentially_And_Skips_Blank_Lines()
    {
        // Arrange: a blank line between records and trailing blank lines must not consume row numbers.
        const string csv =
            "firstName,lastName,email\n" +
            "First,User,first@example.test\n" +
            "\n" +
            "Second,User,second@example.test\n" +
            "   \n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        Assert.Equal(2, rows.Count);
        Assert.Equal(1, rows[0].RowNumber);
        Assert.Equal("first@example.test", rows[0].Email);
        Assert.Equal(2, rows[1].RowNumber);
        Assert.Equal("second@example.test", rows[1].Email);
    }

    [Fact]
    public void Parse_Handles_Rows_With_Fewer_Cells_Than_Header()
    {
        // Arrange: a short row (missing the email cell) yields a null for the absent column rather
        // than throwing — the import service rejects the incomplete row downstream.
        const string csv =
            "firstName,lastName,email\n" +
            "Only,Name\n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        var row = Assert.Single(rows);
        Assert.Equal("Only", row.FirstName);
        Assert.Equal("Name", row.LastName);
        Assert.Null(row.Email);
    }

    [Fact]
    public void Parse_Accepts_Windows_Line_Endings()
    {
        // Arrange
        const string csv =
            "firstName,lastName,email\r\n" +
            "Katherine,Johnson,katherine@example.test\r\n";

        // Act
        var rows = CsvUserImportParser.Parse(csv);

        // Assert
        var row = Assert.Single(rows);
        Assert.Equal("Katherine", row.FirstName);
        Assert.Equal("katherine@example.test", row.Email);
    }

    [Fact]
    public void Parse_Throws_Validation_For_Empty_Content()
    {
        // Act + Assert
        var ex = Assert.Throws<ValidationAppException>(() => CsvUserImportParser.Parse("   \n  \n"));
        Assert.True(ex.Errors.ContainsKey("csvFile"));
    }

    [Fact]
    public void Parse_Throws_Validation_When_Content_Is_Null()
    {
        // Arrange + Act + Assert: a null payload is treated as an empty file (400).
        Assert.Throws<ValidationAppException>(() => CsvUserImportParser.Parse(null!));
    }

    [Fact]
    public void Parse_Throws_Validation_When_Required_Columns_Are_Missing()
    {
        // Arrange: header lacks the required firstName / lastName columns.
        const string csv =
            "name,email\n" +
            "Nobody,nobody@example.test\n";

        // Act + Assert
        var ex = Assert.Throws<ValidationAppException>(() => CsvUserImportParser.Parse(csv));
        Assert.True(ex.Errors.ContainsKey("csvFile"));
    }
}
