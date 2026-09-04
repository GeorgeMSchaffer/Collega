"use client";

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { StatusesScreen } from "@/app/(desk)/settings/_screens/statuses-screen";

export default function ScopedStatusesPage() {
  const params = useParams<{ orgId: string }>();
  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Statuses"
      subject="statuses"
      title="Statuses"
      standfirst={(name) => `${name} · the columns this organization’s boards group ideas by.`}
      rollup={{ href: "/settings/statuses", label: "All statuses" }}
    >
      {(props) => <StatusesScreen {...props} />}
    </ScopedOrgPage>
  );
}
