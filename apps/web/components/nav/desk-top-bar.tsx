"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SidebarInsetHeader,
  SidebarTrigger,
} from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

/**
 * The top bar: breadcrumb on the left, the page's own actions on the right, and — below md,
 * where the sidebar has collapsed into a sheet — the control that opens it.
 *
 * A page renders this itself rather than the layout rendering it from a context: the
 * breadcrumb and the actions belong to the page, and passing them up through a provider only
 * to have the layout put them back is indirection with nothing on the other side of it.
 */

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

export function DeskTopBar({ crumbs, children }: { crumbs: readonly Crumb[]; children?: React.ReactNode }) {
  return (
    <SidebarInsetHeader>
      <SidebarTrigger />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <React.Fragment key={crumb.label}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </SidebarInsetHeader>
  );
}

/** The single scrolling work column comp Q locks at 1320px. */
export function DeskWork({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="max-w-[1320px] min-w-0 p-4 md:p-6">{children}</div>
    </div>
  );
}
