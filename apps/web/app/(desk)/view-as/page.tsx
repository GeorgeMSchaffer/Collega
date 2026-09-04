import type { Metadata } from "next";

import { ViewAsScreen } from "@/components/viewas/screen";

export const metadata: Metadata = {
  title: "View as",
  description: "Act in Collega as one of your users, with both identities on the record.",
};

export default function ViewAsPage() {
  return <ViewAsScreen />;
}
