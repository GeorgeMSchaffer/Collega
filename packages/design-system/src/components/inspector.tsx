"use client";

import { X } from "lucide-react";
import * as React from "react";

import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";

/**
 * The docked inspector.
 *
 * shadcn has no component for this. It looks like a Sheet and borrows the Sheet's header /
 * body / footer anatomy, but comp P locks it as a layout *column*: it is never modal, it
 * never traps focus, and the work behind it stays readable and operable while it is open.
 * A Sheet would be wrong on every one of those counts, so it is a ResizablePanel instead —
 * comp Q's 400px column, which the user can now drag.
 *
 * Usage:
 *
 *   <InspectorLayout open={selected !== null} inspector={<Inspector>…</Inspector>}>
 *     …the board…
 *   </InspectorLayout>
 */

function InspectorLayout({
  children,
  inspector,
  open,
  defaultSize = 28,
  minSize = 20,
  maxSize = 48,
  className,
  autoSaveId = "collega:inspector",
  ...props
}: React.ComponentProps<"div"> & {
  inspector: React.ReactNode;
  open: boolean;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  autoSaveId?: string;
}) {
  const isMobile = useIsMobile();

  // A phone has no room for two columns: at 390px a 28% inspector wraps to one word per
  // line and the work beside it is no better off. Below md the split is dropped entirely
  // and the two stack full width, inspector first since it is what was just opened. The
  // panel group cannot express that in CSS, so the branch is real — and the caller's props
  // go on the wrapper rather than on either branch, so an id or a test hook does not
  // disappear at one breakpoint.
  if (isMobile) {
    return (
      <div className={cn("flex min-w-0 flex-1 flex-col", className)} {...props}>
        {open && inspector}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-1", className)} {...props}>
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId={autoSaveId}
        // isMobile is false until the first effect runs, so on a phone the desktop split is
        // what the server rendered. `hidden md:flex` keeps that first frame from painting a
        // crushed two-column layout before the branch above takes over.
        className="hidden min-w-0 flex-1 md:flex"
      >
        {/* defaultSize on both panels, or the server render has no layout to honour and the
          panels jump to their real widths on hydration. */}
        <ResizablePanel
          id="inspector-main"
          order={1}
          defaultSize={open ? 100 - defaultSize : 100}
          minSize={40}
          className="min-w-0"
        >
          {children}
        </ResizablePanel>
        {open && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="inspector-panel"
              order={2}
              defaultSize={defaultSize}
              minSize={minSize}
              maxSize={maxSize}
              className="min-w-0"
            >
              {inspector}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

function Inspector({
  className,
  "aria-label": ariaLabel = "Inspector",
  ...props
}: React.ComponentProps<"aside">) {
  return (
    // A complementary landmark, not a dialog: it is reachable in reading order and does
    // not take focus away from the work.
    <aside
      data-slot="inspector"
      aria-label={ariaLabel}
      // Docked to the right on desktop, stacked above the work on a phone. The full-height
      // column and its inner scrolling only make sense in the docked case: stacked, it
      // sizes to its content and the page scrolls, so those rules are md-only.
      className={cn(
        "flex min-w-0 flex-col border-b bg-background md:h-full md:border-b-0 md:border-l",
        className,
      )}
      {...props}
    />
  );
}

function InspectorHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="inspector-header"
      className={cn("flex items-start gap-2 border-b px-6 py-4", className)}
      {...props}
    />
  );
}

function InspectorTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="inspector-title"
      className={cn("text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function InspectorDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="inspector-description"
      className={cn("m-0 mt-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function InspectorClose({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="inspector-close"
      variant="ghost"
      size="icon"
      className={cn("ml-auto shrink-0", className)}
      {...props}
    >
      <X className="size-4" />
      <span className="sr-only">Close inspector</span>
    </Button>
  );
}

function InspectorBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="inspector-body"
      className={cn(
        "flex flex-col gap-6 px-6 py-4 md:flex-1 md:overflow-auto",
        className,
      )}
      {...props}
    />
  );
}

function InspectorFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="inspector-footer"
      className={cn("flex gap-2 border-t px-6 py-3 md:mt-auto", className)}
      {...props}
    />
  );
}

export {
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorDescription,
  InspectorFooter,
  InspectorHeader,
  InspectorLayout,
  InspectorTitle,
};
