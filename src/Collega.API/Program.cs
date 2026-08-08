using Collega.API.Authentication;
using Collega.API.Conventions;
using Collega.API.ErrorHandling;
using Collega.API.Validation;
using Collega.Application.Abstractions;
using Collega.Application.Auth;
using Collega.Application.Boards;
using Collega.Application.Organizations;
using Collega.Application.Statuses;
using Collega.Application.Users;
using Collega.Infrastructure.DependencyInjection;
using Collega.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Auth requirement #8: "Startup must fail fast if either is missing" — checked before anything
// else touches configuration, so a misconfigured deployment never gets far enough to serve a
// request pretending to be healthy.
var siteAdminEmail = builder.Configuration["SiteAdmin:Email"];
var siteAdminPassword = builder.Configuration["SiteAdmin:Password"];
if (string.IsNullOrWhiteSpace(siteAdminEmail) || string.IsNullOrWhiteSpace(siteAdminPassword))
{
    throw new InvalidOperationException(
        "Configuration keys 'SiteAdmin:Email' and 'SiteAdmin:Password' are required at startup " +
        "(environment variables SiteAdmin__Email / SiteAdmin__Password, or dotnet user-secrets). " +
        "See SPEC/20-feature-auth.md requirement #8.");
}

// Add services to the container.

builder.Services.AddControllers(options =>
{
    options.Conventions.Add(new ApiVersionRoutePrefixConvention());
    options.ModelMetadataDetailsProviders.Add(new SpacedDisplayNameMetadataProvider());
});

builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddCollegaProblemDetails();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<IClock, Collega.Application.Abstractions.SystemClock>();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITokenAuthenticationService, TokenAuthenticationService>();
builder.Services.AddScoped<IOrganizationBootstrapService, OrganizationBootstrapService>();
builder.Services.AddScoped<IOrganizationService, OrganizationService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IStatusService, StatusService>();
builder.Services.AddScoped<IBoardService, BoardService>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, HttpContextCurrentUserContext>();

builder.Services.AddAuthentication(BearerTokenAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, BearerTokenAuthenticationHandler>(BearerTokenAuthenticationHandler.SchemeName, options => { });
builder.Services.AddAuthorization();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Collega API", Version = "v1" });
});

var app = builder.Build();

// Migrate/create the schema, then run idempotent startup seeding (auth requirements #8-11): the
// global Site Admin always, plus Development-only demo organizations/users. InMemory-provider test
// hosts (see tests/Collega.API.Tests) aren't relational, so EnsureCreated substitutes for Migrate.
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
    if (dbContext.Database.IsRelational())
    {
        await dbContext.Database.MigrateAsync();
    }
    else
    {
        await dbContext.Database.EnsureCreatedAsync();
    }

    var seeder = scope.ServiceProvider.GetRequiredService<IStartupSeeder>();
    await seeder.SeedAsync(siteAdminEmail, siteAdminPassword, app.Environment.IsDevelopment());
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Collega API v1"));
}

// Renders unhandled exceptions (500) and any other non-2xx response that doesn't already carry
// a body (401/403/404 from routing or auth, etc.) as the standard problem-details error envelope.
// AppExceptionHandler (registered above) runs first and maps Application-layer AppException
// subtypes; anything it doesn't recognize falls through to this generic handler.
app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Testing-only shim: exposes Program as a public partial class so
// Microsoft.AspNetCore.Mvc.Testing's WebApplicationFactory<Program> can
// bootstrap this host from tests/Collega.API.Tests. Not application logic.
public partial class Program { }
