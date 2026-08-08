using Collega.API.Validation;
using Collega.Domain.Statuses;

namespace Collega.API.Contracts.Statuses;

/// <summary>Request shape for `PUT /api/v1/statuses/{statusId}`. Color/SortOrder are optional; when
/// omitted the current values are retained.</summary>
public sealed class UpdateStatusRequest
{
    [RequiredField]
    [MaxLengthField(Status.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    [MaxLengthField(Status.ColorMaxLength)]
    public string? Color { get; set; }

    public int? SortOrder { get; set; }
}
