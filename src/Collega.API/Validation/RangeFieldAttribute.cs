using System.ComponentModel.DataAnnotations;

namespace Collega.API.Validation;

/// <summary>
/// Drop-in replacement for <see cref="RangeAttribute"/> that produces the contract-mandated
/// "&lt;FieldName&gt; must be between &lt;Min&gt; and &lt;Max&gt;." message.
/// </summary>
public sealed class RangeFieldAttribute : RangeAttribute
{
    public RangeFieldAttribute(int minimum, int maximum)
        : base(minimum, maximum)
    {
    }

    public RangeFieldAttribute(double minimum, double maximum)
        : base(minimum, maximum)
    {
    }

    public override string FormatErrorMessage(string name) => ValidationMessages.Range(name, Minimum, Maximum);
}
