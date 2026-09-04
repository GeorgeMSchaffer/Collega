import type { Metadata } from "next";

import { HubScreen } from "@/app/(desk)/settings/_screens/hub-screen";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your profile, and the organization configuration your role can reach.",
};

export default function SettingsPage() {
  return <HubScreen />;
}
