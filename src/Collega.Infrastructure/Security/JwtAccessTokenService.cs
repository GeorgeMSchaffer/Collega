using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Collega.Application.Abstractions;

namespace Collega.Infrastructure.Security;

/// <summary>
/// Hand-built HS256 JWT issuer/validator (SPEC/30-Contracts.md "Access Token Format and Session
/// Revocation", resolved 2026-08-07). Produces a standard three-segment
/// base64url(header).base64url(payload).base64url(signature) JWT using only BCL
/// System.Text.Json + System.Security.Cryptography — deliberately not the
/// System.IdentityModel.Tokens.Jwt or Microsoft.AspNetCore.Authentication.JwtBearer NuGet packages
/// (CLAUDE.md: "no new NuGet packages without approval"). The payload embeds the user's
/// SecurityStamp as a custom "sstamp" claim; this class only verifies the signature and expiry —
/// revalidating "sstamp" against the current database value is the caller's job (see
/// Collega.Application.Auth.TokenAuthenticationService).
///
/// Signing-key note for the reviewer: see the AccessTokenOptions registration in
/// InfrastructureServiceCollectionExtensions — if no `Auth:TokenSigningKey` is configured, a random
/// key is generated once per process start, meaning all outstanding tokens are invalidated on
/// restart/redeploy and are not shared across multiple API instances. That's acceptable for this
/// slice but should be set explicitly (and kept stable) for any multi-instance or long-uptime
/// deployment.
/// </summary>
public sealed class JwtAccessTokenService : IAccessTokenIssuer, IAccessTokenValidator
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AccessTokenOptions _options;

    public JwtAccessTokenService(AccessTokenOptions options)
    {
        _options = options;
    }

    public AccessTokenResult Issue(Guid userId, string securityStamp, DateTime nowUtc)
    {
        var issuedAtUnixSeconds = new DateTimeOffset(nowUtc).ToUnixTimeSeconds();
        var expiresAtUnixSeconds = new DateTimeOffset(nowUtc.Add(_options.Lifetime)).ToUnixTimeSeconds();

        var header = new JwtHeader("HS256", "JWT");
        var payload = new JwtPayload(userId.ToString(), securityStamp, issuedAtUnixSeconds, expiresAtUnixSeconds);

        var headerSegment = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(header, JsonOptions));
        var payloadSegment = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions));
        var signingInput = $"{headerSegment}.{payloadSegment}";
        var signatureSegment = Base64UrlEncode(ComputeSignature(signingInput));

        var token = $"{signingInput}.{signatureSegment}";
        return new AccessTokenResult(token, (int)_options.Lifetime.TotalSeconds);
    }

    public bool TryValidate(string token, DateTime nowUtc, out Guid userId, out string securityStamp)
    {
        userId = default;
        securityStamp = string.Empty;

        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return false;
        }

        var signingInput = $"{parts[0]}.{parts[1]}";

        byte[] signature;
        JwtPayload? payload;
        try
        {
            signature = Base64UrlDecode(parts[2]);
            payload = JsonSerializer.Deserialize<JwtPayload>(Base64UrlDecode(parts[1]), JsonOptions);
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            return false;
        }

        var expectedSignature = ComputeSignature(signingInput);
        if (signature.Length != expectedSignature.Length || !CryptographicOperations.FixedTimeEquals(signature, expectedSignature))
        {
            return false;
        }

        if (payload is null || string.IsNullOrEmpty(payload.Sub) || !Guid.TryParse(payload.Sub, out var parsedUserId))
        {
            return false;
        }

        var expiresAtUtc = DateTimeOffset.FromUnixTimeSeconds(payload.Exp).UtcDateTime;
        if (expiresAtUtc <= nowUtc)
        {
            return false;
        }

        userId = parsedUserId;
        securityStamp = payload.Sstamp ?? string.Empty;
        return true;
    }

    private byte[] ComputeSignature(string signingInput)
    {
        using var hmac = new HMACSHA256(_options.SigningKey);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(signingInput));
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string text)
    {
        var padded = text.Replace('-', '+').Replace('_', '/');
        padded += (padded.Length % 4) switch
        {
            2 => "==",
            3 => "=",
            _ => string.Empty
        };
        return Convert.FromBase64String(padded);
    }

    private sealed record JwtHeader(
        [property: JsonPropertyName("alg")] string Alg,
        [property: JsonPropertyName("typ")] string Typ);

    private sealed record JwtPayload(
        [property: JsonPropertyName("sub")] string Sub,
        [property: JsonPropertyName("sstamp")] string Sstamp,
        [property: JsonPropertyName("iat")] long Iat,
        [property: JsonPropertyName("exp")] long Exp);
}
