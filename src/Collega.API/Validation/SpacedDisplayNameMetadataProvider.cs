using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;

namespace Collega.API.Validation;

/// <summary>
/// SPEC/30-Contracts.md "Validation Message Conventions" (resolved 2026-08-07): message text uses
/// spaced Title Case (e.g. "First Name is required."), while the `errors` object keys stay
/// camelCase to match wire JSON. RequiredFieldAttribute/MaxLengthFieldAttribute/etc. build their
/// message from ModelMetadata.DisplayName, which — with no explicit [Display] attribute — normally
/// defaults to the raw, unspaced PascalCase property name (e.g. "FirstName"). This provider fills
/// in a spaced display name from the property name so every current and future request DTO gets
/// contract-correct wording for free; an explicit [Display(Name = "...")] on a property always
/// wins over this default.
/// </summary>
public sealed class SpacedDisplayNameMetadataProvider : IDisplayMetadataProvider
{
    private static readonly Regex WordBoundary = new("(?<=[a-z0-9])(?=[A-Z])", RegexOptions.Compiled);

    public void CreateDisplayMetadata(DisplayMetadataProviderContext context)
    {
        if (context.DisplayMetadata.DisplayName is not null)
        {
            return;
        }

        var propertyName = context.Key.Name;
        if (string.IsNullOrEmpty(propertyName))
        {
            return;
        }

        var spacedName = WordBoundary.Replace(propertyName, " ");
        context.DisplayMetadata.DisplayName = () => spacedName;
    }
}
