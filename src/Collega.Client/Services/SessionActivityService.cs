using Microsoft.JSInterop;

namespace Collega.Client.Services;

public sealed class SessionActivityService : IAsyncDisposable
{
    private readonly IJSRuntime _jsRuntime;
    private IJSObjectReference? _module;
    private DotNetObjectReference<SessionActivityService>? _reference;

    public SessionActivityService(IJSRuntime jsRuntime) => _jsRuntime = jsRuntime;

    public event Action<DateTimeOffset>? ActivityRecorded;

    public event Action<string>? LogoutReceived;

    public async Task InitializeAsync()
    {
        if (_module is not null)
        {
            return;
        }

        _module = await _jsRuntime.InvokeAsync<IJSObjectReference>("import", "./js/sessionActivity.js");
        _reference = DotNetObjectReference.Create(this);
        await _module.InvokeVoidAsync("initialize", _reference, AuthSessionStore.LastActivityKey, AuthSessionStore.LogoutMarkerKey);
    }

    public async Task RecordActivityAsync()
    {
        if (_module is not null)
        {
            await _module.InvokeVoidAsync("recordActivity");
        }
    }

    [JSInvokable]
    public Task OnActivity(string timestamp)
    {
        if (DateTimeOffset.TryParse(timestamp, out var activityUtc))
        {
            ActivityRecorded?.Invoke(activityUtc);
        }

        return Task.CompletedTask;
    }

    [JSInvokable]
    public Task OnLogout(string reason)
    {
        LogoutReceived?.Invoke(reason);
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        if (_module is not null)
        {
            try
            {
                await _module.InvokeVoidAsync("dispose");
                await _module.DisposeAsync();
            }
            catch (JSDisconnectedException)
            {
            }
        }

        _reference?.Dispose();
    }
}
