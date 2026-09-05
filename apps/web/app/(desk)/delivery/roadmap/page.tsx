import type { Metadata } from "next";

import { RoadmapScreen } from "@/app/(desk)/delivery/roadmap/roadmap-screen";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Design prototype — outcomes as rows against a quarter or sprint axis.",
};

export default function RoadmapPage() {
  return <RoadmapScreen />;
}
