using Collega.Application.Exceptions;
using Collega.Domain.Enums;

namespace Collega.Application.Abstractions;

/// <summary>
/// Refuses organization-owned content mutations attempted by a Site Admin acting as themselves
/// (SPEC/20-feature-view-as.md rules 25-25b). View As is the mutation path.
/// </summary>
public static class OrgContentMutationGuard
{
    /// <summary>
    /// Call at the top of every create/edit/delete path for org-owned content — boards, statuses,
    /// idea types, business impacts, custom fields, ideas, comments, tags.
    /// </summary>
    /// <remarks>
    /// <para><b>No impersonation special case, deliberately.</b> While a View As session is live,
    /// <see cref="ICurrentUserContext.Role"/> reports the <i>target's</i> role rather than
    /// <c>SiteAdmin</c>, so this simply does not fire. One guard therefore blocks the direct path and
    /// permits the View As path, and the property that makes rule 4 work is what makes that true.</para>
    ///
    /// <para><b>Not for organization or user administration.</b> Those are the bootstrap exception
    /// (rule 26) — without them a fresh deployment could never be set up, because there would be no
    /// user to act as. This guard belongs only on org-<i>content</i> paths.</para>
    ///
    /// <para>Reads are untouched: a Site Admin can still see everything, which is what the global
    /// aggregate views depend on.</para>
    /// </remarks>
    public static void EnsureNotDirectSiteAdmin(this ICurrentUserContext currentUser)
    {
        if (currentUser.Role == Role.SiteAdmin)
        {
            throw new ForbiddenAppException(
                "Site Admins cannot change organization content directly. Use View As to act as a user in that organization.");
        }
    }
}
