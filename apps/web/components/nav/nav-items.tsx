/**
 * The desk's information architecture, locked by `SPEC/20-feature-client-ui.md`: three
 * groups — Workspace, Delivery, Configure — in this order, with these names.
 *
 * `built: false` marks a route the conversion has not reached yet. Comp Q renders those
 * under a *not built* strip rather than dropping them, so the shape of the product is
 * visible from the first slice; they render as plain rows, out of the tab order, because a
 * focusable control that does nothing is worse than no control.
 *
 * Icons are inline SVG paths from comp Q. They are decorative — every item has its name
 * beside it — so each is `aria-hidden`.
 */

import { EYE_PATH } from "@/components/viewas/eye-icon";
import type { Role } from "@/lib/types";

export interface NavItem {
  readonly label: string;
  readonly href?: string;
  readonly path: string;
  readonly built: boolean;
  /**
   * The roles the item is worth showing to. Absent means everybody, which is every item but
   * one. Gating the rail is a convenience and never the authorization — the route behind an
   * item refuses on its own — so an item shown to the wrong role costs discoverability, not
   * access.
   *
   * Nothing reads this yet: `SidebarNav` in `components/nav/desk-shell.tsx` renders every
   * item, and that file belongs to another slice. Wrapping the `<SidebarMenuItem>` there in
   * `<ForRoles roles={item.roles ?? ROLES}>` is the one line that turns it on.
   */
  readonly roles?: readonly Role[];
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Home",
        href: "/",
        built: true,
        path: "M10 2.6 2.8 8.3a1 1 0 0 0-.4.8V16a1.4 1.4 0 0 0 1.4 1.4h3.4v-4.6h5.6v4.6h3.4A1.4 1.4 0 0 0 17.6 16V9.1a1 1 0 0 0-.4-.8Z",
      },
      {
        label: "Boards",
        href: "/boards",
        built: true,
        path: "M3 4.4A1.4 1.4 0 0 1 4.4 3h11.2A1.4 1.4 0 0 1 17 4.4v11.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 15.6Zm2 .6v10h3.2V5Zm5.2 0v6.4H15V5Z",
      },
      {
        label: "Ideas",
        href: "/ideas",
        built: true,
        path: "M10 2a5 5 0 0 0-3 9v1.6a1.4 1.4 0 0 0 1.4 1.4h3.2a1.4 1.4 0 0 0 1.4-1.4V11A5 5 0 0 0 10 2ZM8.2 15.6h3.6v.8a1.4 1.4 0 0 1-1.4 1.4h-.8a1.4 1.4 0 0 1-1.4-1.4Z",
      },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Sprint board", built: false, path: "M4 3h12v2H4Zm0 4h8v2H4Zm0 4h12v2H4Zm0 4h6v2H4Z" },
      { label: "Backlog", built: false, path: "M4 5h12v2H4Zm0 4h12v2H4Zm0 4h8v2H4Z" },
      { label: "Roadmap", built: false, path: "M3 5.5 7.5 4l5 1.5L17 4v10.5L12.5 16l-5-1.5L3 16Zm5 1.1v7.2l4 1.2V7.8Z" },
    ],
  },
  {
    label: "Configure",
    items: [
      {
        // The second of the two entry points `SPEC/20-feature-view-as.md` D-PLACE locks; the
        // first is the right-aligned control the desk strip renders on every screen. Both,
        // deliberately: View As is the Site Admin's only path to creating organization
        // content, and Sprint 6.5 exists because one entry point was not enough to find it.
        label: "View as…",
        href: "/view-as",
        built: true,
        roles: ["SiteAdmin", "OrgAdmin"],
        path: EYE_PATH,
      },
      {
        label: "Settings",
        built: false,
        path: "M10 7.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-1.4-5.4a1 1 0 0 1 1-.8h.8a1 1 0 0 1 1 .8l.2 1.3 1.2.7 1.2-.5a1 1 0 0 1 1.2.4l.4.7a1 1 0 0 1-.2 1.3l-1 .8v1.4l1 .8a1 1 0 0 1 .2 1.3l-.4.7a1 1 0 0 1-1.2.4l-1.2-.5-1.2.7-.2 1.3a1 1 0 0 1-1 .8h-.8a1 1 0 0 1-1-.8l-.2-1.3-1.2-.7-1.2.5a1 1 0 0 1-1.2-.4l-.4-.7a1 1 0 0 1 .2-1.3l1-.8V8.1l-1-.8a1 1 0 0 1-.2-1.3l.4-.7a1 1 0 0 1 1.2-.4l1.2.5 1.2-.7Z",
      },
    ],
  },
];

export function NavIcon({ path }: { path: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d={path} />
    </svg>
  );
}
