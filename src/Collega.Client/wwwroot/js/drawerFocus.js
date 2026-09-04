// Modal behaviour for DrawerShell that Blazor cannot express on its own: disabling the background
// while a drawer is open (so `aria-modal="true"` on the panel is true rather than a claim), and
// returning focus to whatever opened the drawer when it closes.
//
// A drawer is rendered inline wherever its host component sits, not at the document root, so "the
// background" is every *sibling* along the path from the panel up to <body> — marking an ancestor
// inert would mark the drawer itself. Keyed by the panel's stable per-instance id rather than by
// element, because deactivate runs after Blazor has already removed the panel from the DOM.

const openDrawers = new Map();

function keepInteractive(element) {
    // The drawer's own backdrop: clicking it is one of the three documented ways to dismiss.
    if (element.classList.contains("surface-backdrop")) {
        return true;
    }

    // Surfaces that sit *above* an open drawer rather than behind it. Fluent renders them as
    // siblings of the page content at the app root: the session-expiry dialog (the only way back
    // from an expiring session) and the toast, menu and tooltip provider hosts, which is where a
    // popover raised from inside the drawer would land. Blazor's unhandled-error bar is here for
    // the same reason — its Reload link has to stay clickable.
    if (element.id === "blazor-error-ui" || element.tagName.startsWith("FLUENT-")) {
        return true;
    }

    return typeof element.className === "string" && element.className.includes("fluent-");
}

export function activate(key, panel) {
    if (openDrawers.has(key)) {
        return;
    }

    const inerted = [];
    for (let node = panel; node && node !== document.body && node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
            // Already inert means an outer drawer owns it; leave it to that drawer to restore.
            if (sibling === node || sibling.inert || keepInteractive(sibling)) {
                continue;
            }

            sibling.inert = true;
            inerted.push(sibling);
        }
    }

    // Read before the caller focuses the panel, so this is the control that opened the drawer.
    openDrawers.set(key, { inerted, invoker: document.activeElement });
}

export function deactivate(key) {
    const state = openDrawers.get(key);
    if (!state) {
        return;
    }

    openDrawers.delete(key);
    for (const element of state.inerted) {
        element.inert = false;
    }

    // Skip <body>: that is what activeElement reports when the drawer was opened from something
    // unfocusable, and there is nothing meaningful to go back to.
    const invoker = state.invoker;
    if (invoker && invoker !== document.body && invoker.isConnected) {
        invoker.focus();
    }
}
