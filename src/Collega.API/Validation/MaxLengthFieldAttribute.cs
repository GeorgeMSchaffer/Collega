using System.ComponentModel.DataAnnotations;

namespace Collega.API.Validation;

/// <summary>
/// Drop-in replacement for <see cref="MaxLengthAttribute"/> that produces the contract-mandated
/// "&lt;FieldName&gt; must be &lt;N&gt; characters or fewer." message.
/// </summary>
public sealed class MaxLengthFieldAttribute : MaxLengthAttribute
{
    public MaxLengthFieldAttribute(int length)
        : base(length)
    {
    }

    public override string FormatErrorMessage(string name) => ValidationMessages.MaxLength(name, Length);
}
