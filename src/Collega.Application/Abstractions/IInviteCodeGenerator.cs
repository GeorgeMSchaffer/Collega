namespace Collega.Application.Abstractions;

/// <summary>
/// Generates organization invite codes. Lives behind an abstraction so the randomness stays out of
/// the Application layer (keeping use cases hermetic); Infrastructure supplies the implementation.
/// </summary>
public interface IInviteCodeGenerator
{
    /// <summary>A fresh, random invite code. Uniqueness across organizations is the caller's concern.</summary>
    string Generate();
}
