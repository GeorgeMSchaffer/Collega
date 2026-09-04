"use client";

import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import * as React from "react";

import { useIsMobile } from "../../hooks/use-mobile";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

// Comp P locks the desk sidebar as a fixed 256px column, so this is the shadcn Sidebar
// anatomy over that layout rather than the full collapsible-to-icon-rail variant: the
// column is static on desktop and becomes an off-canvas Sheet below md. E2 owns the desk
// shell and can extend from here; the class strings are build_q.py's REG entries for
// `side`, `brand`, `org`, `navlbl`, `nav` and `me`.

type SidebarContextValue = {
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context)
    throw new Error("useSidebar must be used within a <SidebarProvider>");
  return context;
}

function SidebarProvider({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  const value = React.useMemo(
    () => ({ openMobile, setOpenMobile, isMobile }),
    [openMobile, isMobile],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        className={cn("flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  // `hidden md:flex` on the docked column, because isMobile is false until the first effect
  // runs: without it a phone paints the 256px column and then drops it.
  const column = (extra = "hidden md:flex") => (
    <div
      data-slot="sidebar"
      className={cn(
        "w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground",
        extra,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        {/* The Sheet is a Radix Dialog, so on mobile the nav traps focus, closes on
            Escape, and returns focus to the trigger — the same floor as any modal. */}
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Collega sections
          </SheetDescription>
          {column("flex w-full border-r-0")}
        </SheetContent>
      </Sheet>
    );
  }

  return column();
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpenMobile, openMobile } = useSidebar();
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="outline"
      size="icon"
      aria-expanded={openMobile}
      className={cn("md:hidden", className)}
      onClick={(event) => {
        onClick?.(event);
        setOpenMobile(!openMobile);
      }}
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Toggle navigation</span>
    </Button>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex items-center gap-2 px-2 py-3 text-base font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarOrg({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-org"
      className={cn(
        "px-2 pb-3 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-auto",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      // REG has text-sidebar-foreground/70 here, which composites to ~3.9:1 on the white
      // sidebar — below AA at 12px. text-muted-foreground is the nearest token that clears
      // it, and is what shadcn's own SidebarGroupLabel uses.
      className={cn(
        "flex h-8 items-center px-2 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn(
        "m-0 flex w-full min-w-0 list-none flex-col gap-0.5 p-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

function SidebarMenuButton({
  className,
  asChild,
  isActive,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    // aria-current="page" is both the semantics and the styling hook, so the active item is
    // never distinguished by its tint alone — it also carries the weight change.
    <Comp
      data-slot="sidebar-menu-button"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        "ml-auto text-xs tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "mt-auto flex items-center gap-2 border-t px-2 py-2.5 text-sm",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

function SidebarInsetHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="sidebar-inset-header"
      className={cn(
        "flex min-h-14 flex-wrap items-center gap-2 border-b bg-background px-6 py-2",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInsetHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarOrg,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
};
