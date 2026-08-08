using Collega.API.Validation;
using Collega.Domain.Organizations;

namespace Collega.API.Contracts.Organizations;

/// <summary>Request shape for `POST /api/v1/organizations` (SPEC/30-Contracts.md).</summary>
public sealed class CreateOrganizationRequest
{
    [RequiredField]
    [MaxLengthField(Organization.TitleMaxLength)]
    public string Title { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(Organization.DescriptionMaxLength)]
    public string Description { get; set; } = string.Empty;

    [MaxLengthField(Organization.LogoUrlMaxLength)]
    public string? LogoUrl { get; set; }

    [MaxLengthField(Organization.AddressMaxLength)]
    public string? Address { get; set; }

    [MaxLengthField(Organization.CityMaxLength)]
    public string? City { get; set; }

    [MaxLengthField(Organization.StateMaxLength)]
    public string? State { get; set; }

    [MaxLengthField(Organization.ZipMaxLength)]
    public string? Zip { get; set; }

    [MaxLengthField(Organization.PhoneMaxLength)]
    public string? Phone { get; set; }

    [MaxLengthField(Organization.ContactNameMaxLength)]
    public string? PrimaryContactFirstName { get; set; }

    [MaxLengthField(Organization.ContactNameMaxLength)]
    public string? PrimaryContactLastName { get; set; }
}
