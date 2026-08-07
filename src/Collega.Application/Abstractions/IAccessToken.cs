namespace Collega.Application.Abstractions;

/// <summary>
/// Signed-JWT access token issuance/validation ports (SPEC/30-Contracts.md "Access Token Format
/// and Session Revocation", SPEC/20-feature-auth.md #35-36, resolved 2026-08-07). The JWT embeds
/// the issuing User.SecurityStamp as a claim; validation only checks the signature and expiry here
/// — the caller (Collega.Application.Auth.TokenAuthenticationService) is responsible for
/// revalidating the returned <paramref name="securityStamp"/> against the user's current database
/// value. The concrete implementation lives in Infrastructure as a hand-built HS256 JWT using only
/// BCL cryptography/JSON — no JWT/Identity NuGet package is added for this (CLAUDE.md: "no new
/// NuGet packages without approval").
/// </summary>
public interface IAccessTokenIssuer
{
    AccessTokenResult Issue(Guid userId, string securityStamp, DateTime nowUtc);
}

public interface IAccessTokenValidator
{
    bool TryValidate(string token, DateTime nowUtc, out Guid userId, out string securityStamp);
}

public sealed record AccessTokenResult(string Token, int ExpiresInSeconds);
