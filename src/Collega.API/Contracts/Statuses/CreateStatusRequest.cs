using Collega.API.Validation;
using Collega.Domain.Statuses;

namespace Collega.API.Contracts.Statuses;

/// <summary>
/// Request shape for `POST /api/v1/organizations/{organizationId}/statuses`. <c>Color</c> and
/// <c>SortOrder</c> are optional (SPEC/20-feature-boards-and-statuses.md rules #9-10): when omitted
/// the status gets the organization's neutral color and is appended to the end of the catalog.
/// </summary>
public sealed class CreateStatusRequest
{
    [RequiredField]
    [MaxLengthField(Status.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    [MaxLengthField(Status.ColorMaxLength)]
    public string? Color { get; set; }

    public int? SortOrder { get; set; }
}
