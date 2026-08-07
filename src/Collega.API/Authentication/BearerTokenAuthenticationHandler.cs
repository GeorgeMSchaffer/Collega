using System.Security.Claims;
using System.Text.Encodings.Web;
using Collega.Application.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Collega.API.Authentication;

/// <summary>
/// Custom "Bearer" authentication scheme backed by <see cref="ITokenAuthenticationService"/>.
/// Deliberately not Microsoft.AspNetCore.Authentication.JwtBearer (CLAUDE.md: "no new NuGet
/// packages without approval") — AuthenticationHandler itself ships in the ASP.NET Core shared
/// framework already referenced by Collega.API's Microsoft.NET.Sdk.Web project, so no package
/// addition is needed either way.
/// </summary>
public sealed class BearerTokenAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Bearer";
    private const string BearerPrefix = "Bearer ";

    private readonly ITokenAuthenticationService _tokenAuthenticationService;

    public BearerTokenAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ITokenAuthenticationService tokenAuthenticationService)
        : base(options, logger, encoder)
    {
        _tokenAuthenticationService = tokenAuthenticationService;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var headerValues))
        {
            return AuthenticateResult.NoResult();
        }

        var header = headerValues.ToString();
        if (!header.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.NoResult();
        }

        var token = header[BearerPrefix.Length..].Trim();
        if (string.IsNullOrEmpty(token))
        {
            return AuthenticateResult.NoResult();
        }

        var principal = await _tokenAuthenticationService.AuthenticateAsync(token, Context.RequestAborted);
        if (principal is null)
        {
            return AuthenticateResult.Fail("Invalid, expired, or unknown bearer token.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, principal.UserId.ToString()),
            new(ClaimTypes.Email, principal.Email),
            new(ClaimTypes.Role, principal.Role.ToString()),
            new(ClaimTypes.GivenName, principal.FirstName),
            new(ClaimTypes.Surname, principal.LastName),
            new(CollegaClaimTypes.Status, principal.Status.ToString())
        };

        if (principal.OrganizationId.HasValue)
        {
            claims.Add(new Claim(CollegaClaimTypes.OrganizationId, principal.OrganizationId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(claims, SchemeName);
        var claimsPrincipal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(claimsPrincipal, SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}

public static class CollegaClaimTypes
{
    public const string OrganizationId = "collega:organizationId";
    public const string Status = "collega:status";
}
