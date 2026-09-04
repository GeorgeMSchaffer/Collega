import { Suspense } from "react";

import { DeskShell } from "@/components/nav/desk-shell";

/**
 * Every signed-in screen renders inside the desk. The shell is a client component — the
 * identity that decides what the API answers is chosen in the browser, so there is nothing
 * useful to render on the server ahead of it — and the Suspense boundary is what lets a page
 * below read the URL's search parameters (the inspector's `?idea=`) without opting the whole
 * route out of the build.
 */
export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DeskShell>{children}</DeskShell>
    </Suspense>
  );
}
