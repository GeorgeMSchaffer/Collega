// Modal behaviour for DrawerShell that Blazor cannot express on its own: disabling the background
// while a drawer is open (so `aria-modal="true"` on the panel is true rather than a claim), and
// returning focus to whatever opened the drawer when it closes.
//
// A drawer is rendered inline wherever its host component sits, not at the document root, so "the
// background" is every *sibling* along the path from the panel up to <body> — marking an ancestor
// inert would mark the drawer itself. Keyed by the panel's stable per-instance id rather than by
// element, because deactivate runs after Blazor has already removed the panel from the DOM.

const openDrawers = new Map();

// Body children that render nothing, so marking them inert is a no-op that only clutters the
// ledger a reader inspects when checking containment. index.html puts two <script>s here.
const NON_RENDERED = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK", "META", "TITLE"]);

// The control that opened the surface, remembered a step ahead of when it is needed.
//
// activate() runs from OnAfterRenderAsync, i.e. after the render that opened the surface — and
// several admin pages disable their "Add New" / "Details" button in that same render
// (StatusesAdmin, IdeaTypesAdmin). Disabling a focused element blurs it synchronously, so by the
// time activate() reads document.activeElement it is already <body> and the restore is lost.
// Tracking focus as it moves keeps the real invoker. Capture phase, because focusin from inside
// a shadow root is retargeted but still passes here.
let lastFocused = null;
document.addEventListener("focusin", (event) => {
    if (event.target instanceof Element && event.target !== document.body) {
        lastFocused = event.target;
    }
}, true);

function keepInteractive(element) {
    // The drawer's own backdrop: clicking it is one of the three documented ways to dismiss.
    if (element.classList.contains("surface-backdrop")) {
        return true;
    }

    // Surfaces that sit *above* an open drawer rather than behind it, rendered by App.razor as
    // siblings of the page content: the session-expiry dialog, which is the only way back from an
    // expiring session, and Fluent's design-theme and provider hosts. Blazor's unhandled-error bar
    // is kept for the same reason — its Reload link has to stay clickable.
    //
    // This is a tag/class test, not an identity one, and it is only safe because no host page puts
    // a <Fluent…> component at its own top level: every DrawerShell host renders .pagehead, .body
    // and the shells, and MainLayout adds only plain divs. Putting a FluentButton or FluentSearch
    // at the top level of such a page, or as a direct child of .shell-main, would leave it
    // reachable behind an open drawer. Verified across all nine entry points on 2026-09-04.
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
            // Already inert means an outer surface owns it; leave it to that one to restore.
            // NON_RENDERED is checked by tag rather than by computed style or checkVisibility():
            // those would need a support test, and getting it wrong fails *open* — every sibling
            // skipped and no containment at all, with nothing to see in the DOM.
            if (sibling === node || sibling.inert || NON_RENDERED.has(sibling.tagName) || keepInteractive(sibling)) {
                continue;
            }

            sibling.inert = true;
            inerted.push(sibling);
        }
    }

    // Read before the caller focuses the panel, so this is the control that opened the surface.
    // activeElement is <body> when that control was disabled by the opening render; lastFocused
    // is what it was a moment earlier.
    const active = document.activeElement;
    const invoker = active && active !== document.body ? active : lastFocused;
    openDrawers.set(key, { inerted, invoker });
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
