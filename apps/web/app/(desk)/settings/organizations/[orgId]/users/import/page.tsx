"use client";

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { ImportScreen } from "@/app/(desk)/settings/_screens/import-screen";

export default function ScopedImportPage() {
  const params = useParams<{ orgId: string }>();
  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Import"
      subject="the user import"
      rollup={{ href: "/settings/users", label: "All users" }}
      orgCrumb={{ href: `/settings/organizations/${params.orgId}/users` }}
    >
      {(props) => <ImportScreen {...props} title="Import users" />}
    </ScopedOrgPage>
  );
}
