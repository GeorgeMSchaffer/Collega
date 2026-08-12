using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>
/// Request shape for `PUT /api/v1/auth/me/portrait` (SPEC/30-Contracts.md). Carries the raw,
/// unmodified bytes of the chosen file, Base64-encoded, so the server can decode and validate the
/// actual content. The declared file name / MIME type are deliberately not part of the contract —
/// content, not metadata, is what the server trusts.
/// </summary>
public sealed class UpdatePortraitRequest
{
    [RequiredField]
    public string ImageBase64 { get; set; } = string.Empty;
}
