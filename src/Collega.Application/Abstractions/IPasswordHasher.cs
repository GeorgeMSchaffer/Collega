namespace Collega.Application.Abstractions;

/// <summary>
/// Port for password hashing/verification. Concrete implementation lives in Infrastructure
/// (PBKDF2 via the .NET BCL — see CLAUDE.md "no new NuGet packages without approval").
/// </summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}
