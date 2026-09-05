import type { Metadata } from "next";

import { SprintBoardScreen } from "@/app/(desk)/delivery/sprint-board-screen";

export const metadata: Metadata = {
  title: "Sprint board",
  description: "Design prototype — the running sprint's issues in the five fixed delivery statuses.",
};

export default function SprintBoardPage() {
  return <SprintBoardScreen />;
}
