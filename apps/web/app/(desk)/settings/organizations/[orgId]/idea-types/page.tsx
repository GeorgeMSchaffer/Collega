"use client";

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { IdeaTypesScreen } from "@/app/(desk)/settings/_screens/idea-types-screen";

export default function ScopedIdeaTypesPage() {
  const params = useParams<{ orgId: string }>();
  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Idea types"
      subject="idea types"
      title="Idea types"
      standfirst={(name) => `${name} · the types this organization’s ideas are created as.`}
      rollup={{ href: "/settings/idea-types", label: "All idea types" }}
    >
      {(props) => <IdeaTypesScreen {...props} />}
    </ScopedOrgPage>
  );
}
