import type { Metadata } from "next";

import { ProfileScreen } from "@/app/(desk)/settings/_screens/profile-screen";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Edit your name and change your password.",
};

export default function ProfilePage() {
  return <ProfileScreen />;
}
