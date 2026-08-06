using Collega.API.Conventions;
using Collega.API.ErrorHandling;
using Collega.Application.Abstractions;
using Collega.Infrastructure.DependencyInjection;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers(options =>
{
    options.Conventions.Add(new ApiVersionRoutePrefixConvention());
});

builder.Services.AddCollegaProblemDetails();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<IClock, SystemClock>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Collega API", Version = "v1" });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Collega API v1"));
}

// Renders unhandled exceptions (500) and any other non-2xx response that doesn't already carry
// a body (401/403/404 from routing or auth, etc.) as the standard problem-details error envelope.
app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program
{
}
