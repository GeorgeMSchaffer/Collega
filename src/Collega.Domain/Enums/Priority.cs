namespace Collega.Domain.Enums;

/// <summary>
/// Idea priority (SPEC/20-feature-ideas-and-engagement.md "Idea Rules" #2). Distinct from the
/// organization-configurable Idea Type and Business Impact fields.
/// </summary>
public enum Priority
{
    Low,
    Medium,
    High,
    Critical
}
