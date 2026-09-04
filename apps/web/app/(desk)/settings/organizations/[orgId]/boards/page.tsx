"use client";

/**
 * Read-only, unlike Users · org. A board is organization-owned content, so rule 25 refuses a
 * Site Admin every change to it; user administration is the bootstrap exception and boards
 * are not.
 */

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { BoardsScreen } from "@/app/(desk)/settings/_screens/boards-screen";

export default function ScopedBoardsPage() {
  const params = useParams<{ orgId: string }>();
  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Boards"
      subject="boards"
      title="Boards"
      standfirst={(name) => `${name} · the boards this organization tracks ideas on.`}
      // Not /settings/boards: that route has no Site Admin story, and a Site Admin is
      // the only role that can open this one — so the way back is where they picked
      // the organization in the first place.
      rollup={{ href: "/settings/organizations", label: "Organizations" }}
    >
      {(props) => (
        <BoardsScreen
          {...props}
          basePath={`/settings/organizations/${params.orgId}/boards`}
        />
      )}
    </ScopedOrgPage>
  );
}
