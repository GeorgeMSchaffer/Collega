import type { Metadata } from "next";

import { IdeasScreen } from "@/app/(desk)/ideas/ideas-screen";

export const metadata: Metadata = {
  title: "Ideas",
  description: "Every idea in the organization, across all boards.",
};

export default function IdeasPage() {
  return <IdeasScreen />;
}
