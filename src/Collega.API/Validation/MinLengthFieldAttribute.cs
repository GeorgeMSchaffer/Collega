using System.ComponentModel.DataAnnotations;

namespace Collega.API.Validation;

/// <summary>
/// Drop-in replacement for <see cref="MinLengthAttribute"/> that produces the contract-mandated
/// "&lt;FieldName&gt; must be at least &lt;N&gt; characters." message.
/// </summary>
public sealed class MinLengthFieldAttribute : MinLengthAttribute
{
    public MinLengthFieldAttribute(int length)
        : base(length)
    {
    }

    public override string FormatErrorMessage(string name) => ValidationMessages.MinLength(name, Length);
}
