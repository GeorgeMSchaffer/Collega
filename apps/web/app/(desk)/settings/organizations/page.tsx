"use client";

import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useWorkspace } from "@/lib/workspace";

import { SettingsGuard } from "@/app/(desk)/settings/_components/chrome";
import { OrganizationsScreen } from "@/app/(desk)/settings/_screens/organizations-screen";

export default function OrganizationsPage() {
  const { me, stateOverride } = useWorkspace();

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Settings", href: "/settings" }, { label: "Organizations" }]} />
      <DeskWork>
        <SettingsGuard role={me?.role} audience="site-admin" subject="organizations">
          <PageHeader title="Organizations">Manage organizations across the platform.</PageHeader>
          <OrganizationsScreen role={me?.role} override={stateOverride} />
        </SettingsGuard>
      </DeskWork>
    </>
  );
}
