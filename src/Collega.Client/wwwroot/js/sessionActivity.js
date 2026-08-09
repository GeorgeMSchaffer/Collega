let dotNetReference;
let lastActivityKey;
let logoutMarkerKey;
let lastRecordedAt = 0;
const throttleMilliseconds = 15000;

const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];

function publishActivity(force = false) {
    const now = Date.now();
    if (!force && now - lastRecordedAt < throttleMilliseconds) {
        return;
    }

    lastRecordedAt = now;
    const timestamp = new Date(now).toISOString();
    localStorage.setItem(lastActivityKey, timestamp);
    dotNetReference?.invokeMethodAsync("OnActivity", timestamp);
}

function handleActivity() {
    publishActivity(false);
}

function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
        publishActivity(true);
    }
}

function handleStorage(event) {
    if (event.key === lastActivityKey && event.newValue) {
        dotNetReference?.invokeMethodAsync("OnActivity", event.newValue);
        return;
    }

    if (event.key === logoutMarkerKey && event.newValue) {
        try {
            const marker = JSON.parse(event.newValue);
            dotNetReference?.invokeMethodAsync("OnLogout", marker.reason ?? "logout");
        } catch {
            dotNetReference?.invokeMethodAsync("OnLogout", "logout");
        }
    }
}

export function initialize(reference, activityKey, logoutKey) {
    dotNetReference = reference;
    lastActivityKey = activityKey;
    logoutMarkerKey = logoutKey;

    activityEvents.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);
}

export function recordActivity() {
    publishActivity(true);
}

export function dispose() {
    activityEvents.forEach(eventName => window.removeEventListener(eventName, handleActivity));
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("storage", handleStorage);
    dotNetReference = undefined;
}
