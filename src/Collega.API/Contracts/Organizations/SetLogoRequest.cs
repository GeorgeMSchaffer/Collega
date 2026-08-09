using Collega.API.Validation;

namespace Collega.API.Contracts.Organizations;

/// <summary>Request shape for `PUT /api/v1/organizations/{id}/logo`. The image is resized client-side
/// to at most 150px tall and sent as an image data URI (e.g. <c>data:image/png;base64,…</c>).</summary>
public sealed class SetLogoRequest
{
    [RequiredField]
    public string ThumbnailDataUri { get; set; } = string.Empty;

    public int HeightPx { get; set; }
}
