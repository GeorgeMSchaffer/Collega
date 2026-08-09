using Collega.API.Authentication;
using Collega.API.Conventions;
using Collega.API.ErrorHandling;
using Collega.API.Validation;
using Collega.Application.Abstractions;
using Collega.Application.Auth;
using Collega.Application.Boards;
using Collega.Application.Collaboration;
using Collega.Application.Comments;
using Collega.Application.IdeaFields;
using Collega.Application.Ideas;
using Collega.Application.Organizations;
using Collega.Application.Fields;
using Collega.Application.Statuses;
using Collega.Application.Tags;
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
builder.Services.AddScoped<IFieldDefinitionService, FieldDefinitionService>();
builder.Services.AddScoped<IBoardService, BoardService>();
builder.Services.AddScoped<IIdeaFieldService, IdeaFieldService>();
builder.Services.AddScoped<IMentionResolver, MentionResolver>();
builder.Services.AddScoped<IIdeaService, IdeaService>();
builder.Services.AddScoped<ICommentService, CommentService>();
builder.Services.AddScoped<ITagService, TagService>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, HttpContextCurrentUserContext>();

builder.Services.AddAuthentication(BearerTokenAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, BearerTokenAuthenticationHandler>(BearerTokenAuthenticationHandler.SchemeName, options => { });
builder.Services.AddAuthorization();

// The Blazor WASM client is a separate origin, so it needs CORS to call the API. Auth is via a
// bearer token (not cookies), so no credentials support is required. Allowed origins come from
// configuration (Cors:AllowedOrigins) and default to the client's dev URLs.
const string ClientCorsPolicy = "CollegaClient";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5098", "https://localhost:5098" };
builder.Services.AddCors(options =>
    options.AddPolicy(ClientCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Collega API", Version = "v1" });

    // Fold the generated XML doc file (enabled via <GenerateDocumentationFile> in the .csproj) into
    // the OpenAPI output so controller doc comments and [ProducesResponseType] annotations describe
    // each operation. The file sits next to the assembly in the build output.
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }
});

var app = builder.Build();

// Seeding control. With no --seed:* flags, keep the historical default: always seed the Site Admin,
// seed demo data only under the Development environment. Passing either flag switches to explicit
// mode — only the seeds you name run, regardless of environment. Both parts are idempotent, so the
// flags are a manual trigger (e.g. `dotnet watch --project ./src/Collega.API -- --seed:auth
// --seed:demo`), not a one-shot. See src/Collega.API/CLAUDE.md.
var seedAuthFlag = ReadSeedFlag(args, "seed:auth");
var seedDemoFlag = ReadSeedFlag(args, "seed:demo");
var explicitSeeding = seedAuthFlag is not null || seedDemoFlag is not null;
var seedSiteAdmin = explicitSeeding ? seedAuthFlag ?? false : true;
var seedDemoData = explicitSeeding ? seedDemoFlag ?? false : app.Environment.IsDevelopment();

// Migrate/create the schema, then run idempotent startup seeding (auth requirements #8-11): the
// global Site Admin and demo organizations/users, each gated by the flags resolved above.
// InMemory-provider test hosts (see tests/Collega.API.Tests) aren't relational, so EnsureCreated
// substitutes for Migrate.
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
    await seeder.SeedAsync(siteAdminEmail, siteAdminPassword, seedSiteAdmin, seedDemoData);
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

app.UseCors(ClientCorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Reads a boolean seed switch from the raw command-line args, tolerant of the forms the CLI hands
// us: `--seed:auth`, `/seed:auth`, or `--seed:auth=false`. Returns null when absent (so the caller
// can tell "not specified" from an explicit false), true for a bare flag, or the parsed bool value.
static bool? ReadSeedFlag(string[] args, string name)
{
    foreach (var arg in args)
    {
        var token = arg.TrimStart('-', '/');
        var separator = token.IndexOf('=');
        var key = separator < 0 ? token : token[..separator];
        if (!string.Equals(key, name, StringComparison.OrdinalIgnoreCase))
        {
            continue;
        }

        if (separator < 0)
        {
            return true;
        }

        return bool.TryParse(token[(separator + 1)..], out var value) ? value : true;
    }

    return null;
}

// Testing-only shim: exposes Program as a public partial class so
// Microsoft.AspNetCore.Mvc.Testing's WebApplicationFactory<Program> can
// bootstrap this host from tests/Collega.API.Tests. Not application logic.
public partial class Program { }
