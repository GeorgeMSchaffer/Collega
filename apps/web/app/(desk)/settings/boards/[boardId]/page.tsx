"use client";

import { useParams } from "next/navigation";

import { OwnOrgPage, type ScreenProps } from "@/app/(desk)/settings/_components/pages";
import { BoardFormScreen } from "@/app/(desk)/settings/_screens/board-form-screen";

const BOARDS = [{ label: "Boards", href: "/settings/boards" }];

export default function EditBoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;

  const form = (props: ScreenProps) => (
    <BoardFormScreen {...props} boardId={boardId} backHref="/settings/boards" />
  );

  return (
    <OwnOrgPage
      crumbLabel="Edit"
      extraCrumbs={BOARDS}
      subject="this board"
      orgAdmin={form}
      siteAdmin={form}
    />
  );
}
