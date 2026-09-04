"use client";

import { Avatar, AvatarFallback, SidebarFooter, Skeleton } from "@collega/design-system";

import { ROLE_LABELS, initialsOf } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

/**
 * The identity block pinned to the bottom of the sidebar: avatar, name, role.
 *
 * `SPEC/20-feature-client-ui.md` puts Sign Out in a menu on this block, and during a View As
 * session it shows the impersonated user rather than the administrator. Both belong to E1
 * and the view-as slice; this is the block they hang off, and it renders the real
 * `GET /auth/me` identity today.
 */
export function AccountBlock() {
  const { me, meError } = useWorkspace();

  if (meError) {
    return (
      <SidebarFooter>
        <Avatar>
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate font-semibold">Not signed in</span>
          <span className="block truncate text-xs text-muted-foreground">
            {meError.problem?.title ?? "Identity unavailable"}
          </span>
        </span>
      </SidebarFooter>
    );
  }

  if (!me) {
    return (
      <SidebarFooter>
        <Skeleton className="size-7 rounded-full" />
        <span className="min-w-0 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-1.5 h-2.5 w-16" />
        </span>
      </SidebarFooter>
    );
  }

  return (
    <SidebarFooter data-testid="account-block">
      <Avatar>
        <AvatarFallback>{initialsOf(me.firstName, me.lastName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {me.firstName} {me.lastName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[me.role]}</span>
      </span>
    </SidebarFooter>
  );
}
