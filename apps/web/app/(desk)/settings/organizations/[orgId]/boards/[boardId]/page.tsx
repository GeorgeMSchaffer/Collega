"use client";

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { BoardFormScreen } from "@/app/(desk)/settings/_screens/board-form-screen";

export default function ScopedEditBoardPage() {
  const params = useParams<{ orgId: string; boardId: string }>();
  const boards = `/settings/organizations/${params.orgId}/boards`;

  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Edit"
      subject="this board"
      // Not /settings/boards: that route has no Site Admin story, and a Site Admin is
      // the only role that can open this one — so the way back is where they picked
      // the organization in the first place.
      rollup={{ href: "/settings/organizations", label: "Organizations" }}
      orgCrumb={{ href: boards }}
      scopeNote={false}
    >
      {(props) => <BoardFormScreen {...props} boardId={params.boardId} backHref={boards} />}
    </ScopedOrgPage>
  );
}
