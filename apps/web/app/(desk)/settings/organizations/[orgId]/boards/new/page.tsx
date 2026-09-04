"use client";

/**
 * The route exists so the refusal has somewhere to live. A Site Admin is the only role that
 * can open it, and creating a board is organization-owned content, so what they get is the
 * reason and a way back — never the form.
 */

import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { BoardFormScreen } from "@/app/(desk)/settings/_screens/board-form-screen";

export default function ScopedNewBoardPage() {
  const params = useParams<{ orgId: string }>();
  const boards = `/settings/organizations/${params.orgId}/boards`;

  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="New"
      subject="board creation"
      // Not /settings/boards: that route has no Site Admin story, and a Site Admin is
      // the only role that can open this one — so the way back is where they picked
      // the organization in the first place.
      rollup={{ href: "/settings/organizations", label: "Organizations" }}
      orgCrumb={{ href: boards }}
      scopeNote={false}
    >
      {(props) => <BoardFormScreen {...props} boardId={null} backHref={boards} />}
    </ScopedOrgPage>
  );
}
