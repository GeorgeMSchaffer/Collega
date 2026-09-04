"use client";

/**
 * `/settings/organizations/{orgId}` is not a second page: it is the list with one
 * organization open beside it. `Settings.razor` behaves the same way, and the docked panel is
 * why the list underneath stays live and filterable.
 */

import { useParams } from "next/navigation";

import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useWorkspace } from "@/lib/workspace";

import { SettingsGuard } from "@/app/(desk)/settings/_components/chrome";
import { OrganizationsScreen } from "@/app/(desk)/settings/_screens/organizations-screen";

export default function OrganizationDetailPage() {
  const params = useParams<{ orgId: string }>();
  const { me, stateOverride } = useWorkspace();

  return (
    <>
      <DeskTopBar
        crumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Organizations", href: "/settings/organizations" },
          { label: "Detail" },
        ]}
      />
      <DeskWork>
        <SettingsGuard role={me?.role} audience="site-admin" subject="organizations">
          <PageHeader title="Organizations">Manage organizations across the platform.</PageHeader>
          <OrganizationsScreen
            role={me?.role}
            override={stateOverride}
            openOrganizationId={params.orgId}
          />
        </SettingsGuard>
      </DeskWork>
    </>
  );
}
