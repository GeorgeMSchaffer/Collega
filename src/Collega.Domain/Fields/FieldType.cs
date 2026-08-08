namespace Collega.Domain.Fields;

/// <summary>
/// Supported User-Defined Field types (SPEC/20-feature-user-defined-fields.md "Supported types").
/// Explicit numeric values are the persisted contract — never renumber existing members.
/// <c>Dropdown</c> and <c>MultiSelect</c> are the only types that own <see cref="FieldDefinitionOption"/>s.
/// </summary>
public enum FieldType
{
    Text = 1,
    Number = 2,
    Date = 3,
    Boolean = 4,
    Dropdown = 5,
    MultiSelect = 6,
    Url = 7
}
