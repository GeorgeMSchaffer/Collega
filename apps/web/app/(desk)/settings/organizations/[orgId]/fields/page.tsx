"use client";

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { FieldsScreen } from "@/app/(desk)/settings/_screens/fields-screen";

export default function ScopedFieldsPage() {
  const params = useParams<{ orgId: string }>();
  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Fields"
      subject="fields"
      title="Fields"
      standfirst={(name) => `${name} · the custom fields this organization’s idea types draw from.`}
      rollup={{ href: "/settings/fields", label: "All fields" }}
    >
      {(props) => <FieldsScreen {...props} />}
    </ScopedOrgPage>
  );
}
