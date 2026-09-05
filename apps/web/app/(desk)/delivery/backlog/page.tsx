import type { Metadata } from "next";

import { BacklogScreen } from "@/app/(desk)/delivery/backlog/backlog-screen";

export const metadata: Metadata = {
  title: "Backlog",
  description: "Design prototype — committed issues that are not yet in a sprint.",
};

export default function BacklogPage() {
  return <BacklogScreen />;
}
