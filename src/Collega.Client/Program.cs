using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Collega.Client;
using Collega.Client.Auth;
using Collega.Client.Services;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.FluentUI.AspNetCore.Components;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// The API is a separate origin from the WASM host; its base URL comes from wwwroot/appsettings.json
// so it can be pointed at a real deployment without a rebuild.
var apiBaseUrl = builder.Configuration["Api:BaseUrl"] ?? builder.HostEnvironment.BaseAddress;
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(apiBaseUrl) });

builder.Services.AddScoped<AuthSessionStore>();
builder.Services.AddScoped<ApiClient>();
builder.Services.AddScoped<CollegaAuthStateProvider>();
builder.Services.AddScoped<AuthenticationStateProvider>(sp => sp.GetRequiredService<CollegaAuthStateProvider>());
builder.Services.AddAuthorizationCore();

builder.Services.AddFluentUIComponents();

await builder.Build().RunAsync();
