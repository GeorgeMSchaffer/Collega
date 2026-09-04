import type { Metadata } from "next";

import { BoardsScreen } from "@/app/(desk)/boards/boards-screen";

export const metadata: Metadata = {
  title: "Boards",
  description: "The boards you can reach in this organization.",
};

export default function BoardsPage() {
  return <BoardsScreen />;
}
