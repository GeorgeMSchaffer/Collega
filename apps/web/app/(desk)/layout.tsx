import { Suspense } from "react";

import { DeskShell } from "@/components/nav/desk-shell";
import { ViewAsPicker } from "@/components/viewas/picker";
import { ViewAsProvider } from "@/components/viewas/session";
import { ViewAsStrip } from "@/components/viewas/strip";

/**
 * Every signed-in screen renders inside the desk. The shell is a client component — the
 * identity that decides what the API answers is chosen in the browser, so there is nothing
 * useful to render on the server ahead of it — and the Suspense boundary is what lets a page
 * below read the URL's search parameters (the inspector's `?idea=`) without opting the whole
 * route out of the build.
 *
 * View As is mounted here rather than in the shell because it has to outlive the shell's own
 * work column: `DeskShell` keys that column on the identity, and starting a session changes
 * the identity, so a session held inside it would be destroyed by the thing it just did.
 * `ViewAsProvider` sits above the shell and survives; the strip and the picker render inside
 * it, where the workspace and the role gate can be read.
 *
 * The strip is the first thing in the work column on every screen, which is what rules 20 and
 * 22 both need — the entry control on every screen, and a banner that cannot be navigated
 * away from.
 */
export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ViewAsProvider>
        <DeskShell>
          <ViewAsStrip />
          {children}
          <ViewAsPicker />
        </DeskShell>
      </ViewAsProvider>
    </Suspense>
  );
}
