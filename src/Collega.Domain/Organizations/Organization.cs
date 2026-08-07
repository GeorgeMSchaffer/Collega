using Collega.Domain.Common;

namespace Collega.Domain.Organizations;

/// <summary>
/// Minimal organization entity for the Auth slice (Epic 2). Only what auth needs: org-scoping of
/// <see cref="Collega.Domain.Users.User"/>, self-registration invite-code lookup
/// (SPEC/20-feature-auth.md #17), and the Development-only demo seed. Full organization
/// administration (profile fields, logo, archive workflow, invite-code regeneration endpoint) is
/// out of scope here and belongs to the Tenant Administration Agent slice — see
/// SPEC/20-feature-organizations-and-users.md.
/// </summary>
public sealed class Organization : AuditableEntityBase
{
    public string Title { get; private set; } = string.Empty;
    public string InviteCode { get; private set; } = string.Empty;
    public bool IsArchived { get; private set; }

    private Organization()
    {
    }

    public static Organization Create(string title, string inviteCode, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (string.IsNullOrWhiteSpace(inviteCode))
        {
            throw new ArgumentException("Invite code is required.", nameof(inviteCode));
        }

        var organization = new Organization
        {
            Title = title.Trim(),
            InviteCode = inviteCode.Trim()
        };
        organization.MarkCreated(nowUtc, actorUserId);
        return organization;
    }
}
