"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ForRoles,
  Kbd,
  ROLES,
  RoleProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarOrg,
  SidebarProvider,
  TooltipProvider,
} from "@collega/design-system";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { USE_MOCK_API, useMockIdentity } from "@/mocks";
import { WorkspaceProvider, useWorkspace, type Workspace } from "@/lib/workspace";
import { AccountBlock } from "@/components/nav/account-block";
import { CommandPalette, useCommandPalette } from "@/components/nav/command-palette";
import { DeskWork } from "@/components/nav/desk-top-bar";
import { MockBar } from "@/components/nav/mock-bar";
import { NAV_GROUPS, NavIcon } from "@/components/nav/nav-items";

/**
 * The desk: sidebar, work area, command palette, account footer.
 *
 * Every signed-in screen renders into it and later slices extend it rather than replace it —
 * E1 puts the real session behind `AccountBlock` and adds Sign Out, E4 opens its inspector
 * inside the work column, E5 and E6 add their own routes to `NAV_GROUPS`. So the shell holds
 * chrome and nothing else: no page owns a piece of it, and it owns no page's data.
 *
 * `RoleProvider` is set once, here, from the identity the API reports rather than from the
 * one the switcher asked for — a screen gates on what the server says the viewer is.
 */

function SidebarNav() {
  const pathname = usePathname();
  const boardCount = useWorkspace().boards.data?.length ?? 0;

  return (
    <SidebarContent>
      {NAV_GROUPS.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              // Rule 9 of SPEC/20-feature-view-as.md is "hidden *and* refused — both, not
              // either", and rule 23 says that while acting as someone the rail must show
              // what they would see. An item with no `roles` is for everybody.
              <ForRoles key={item.label} roles={item.roles ?? ROLES}>
                <SidebarMenuItem>
                {item.href ? (
                  // Home is "/", and every other route starts with it — so the prefix test
                  // that is right for "/boards" would mark Home active on every screen.
                  <SidebarMenuButton
                    asChild
                    isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <NavIcon path={item.path} />
                      {item.label}
                      {item.label === "Boards" && boardCount > 0 ? (
                        <SidebarMenuBadge>{boardCount}</SidebarMenuBadge>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  // Not a control: the route does not exist yet, and a focusable item that
                  // does nothing costs a keyboard user a stop for no gain.
                  <span className="flex w-full items-center gap-2 rounded-md p-2 text-sm text-muted-foreground/70">
                    <NavIcon path={item.path} />
                    {item.label}
                    <span className="ml-auto text-xs">Not built</span>
                  </span>
                )}
                </SidebarMenuItem>
              </ForRoles>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}

/**
 * The organization line. A Site Admin belongs to no organization and browses one; a member
 * and a read-only account are refused the organization record outright, so the line falls
 * back to a neutral label rather than guessing at a name.
 */
function OrganizationLine() {
  const { me, organization, organizationRefusal } = useWorkspace();

  if (me?.role === "SiteAdmin") {
    return (
      <SidebarOrg>
        All organizations
        {organization ? (
          <span className="mt-0.5 block font-normal">Browsing {organization.title}</span>
        ) : null}
      </SidebarOrg>
    );
  }

  if (organization) return <SidebarOrg>{organization.title}</SidebarOrg>;
  if (organizationRefusal) return <SidebarOrg>Your organization</SidebarOrg>;
  return <SidebarOrg>&nbsp;</SidebarOrg>;
}

/**
 * Nothing on the desk can load without an identity and an organization, so the two ways
 * those can fail are answered once here rather than by every screen sitting in a loading
 * state that will never resolve. It is a refusal rather than a failure because that is what
 * it is, and it offers the way out the auth spec names — `SPEC/20-feature-auth.md` #34: a
 * token the API no longer recognises returns the viewer to Login.
 */
function NoWorkspace({ blocked }: { blocked: NonNullable<Workspace["blocked"]> }) {
  // The two blocks are different problems. An unrecognised identity is the expired session
  // the auth spec sends back to Login (#34); a Site Admin with no organization to browse is
  // signed in perfectly well and has nothing to sign in *to*, so it gets no such offer.
  const { meError } = useWorkspace();

  return (
    <DeskWork>
      <Alert variant="warning" className="max-w-xl">
        <AlertTitle>{blocked.title}</AlertTitle>
        <AlertDescription>
          {blocked.detail}
          {USE_MOCK_API ? " Choose an identity in the band above to carry on." : ""}
        </AlertDescription>
      </Alert>
      {meError ? (
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/login?reason=session-expired">Go to sign in</Link>
        </Button>
      ) : null}
    </DeskWork>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { identity } = useMockIdentity();
  const { me, blocked } = useWorkspace();
  const palette = useCommandPalette();

  return (
    <RoleProvider role={me?.role ?? "ReadOnly"}>
      <div className="flex min-h-svh flex-col">
        <MockBar />
        <SidebarProvider className="min-h-0 flex-1">
          <Sidebar>
            <SidebarHeader>
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                CG
              </span>
              Collega
            </SidebarHeader>
            <OrganizationLine />
            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              className="mb-1 flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm text-muted-foreground shadow-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span aria-hidden="true">⌕</span>
              <span>Search or jump…</span>
              <Kbd className="ml-auto">Ctrl K</Kbd>
            </button>
            <SidebarNav />
            <AccountBlock />
          </Sidebar>

          {/* Keying the work column on the identity throws away every screen's local state
              — a filter, a page number, a selected row — which is the point: none of it
              survives being somebody else. The key is here rather than around the whole
              shell so that the switcher itself is not destroyed mid-interaction and can
              still be handed focus back. */}
          <SidebarInset key={identity}>
            {blocked ? <NoWorkspace blocked={blocked} /> : children}
          </SidebarInset>
        </SidebarProvider>
      </div>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </RoleProvider>
  );
}

export function DeskShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <WorkspaceProvider>
        <Shell>{children}</Shell>
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
