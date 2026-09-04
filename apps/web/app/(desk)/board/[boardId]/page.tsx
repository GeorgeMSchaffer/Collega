import type { Metadata } from "next";

import { BoardScreen } from "@/app/(desk)/board/[boardId]/board-screen";

export const metadata: Metadata = {
  title: "Board",
  description: "Ideas in swimlane columns, one per status on the board.",
};

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <BoardScreen boardId={boardId} />;
}
