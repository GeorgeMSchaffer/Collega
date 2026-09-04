import type { Metadata } from "next";

import { ChangePasswordScreen } from "@/app/(auth)/change-password/change-password-screen";

export const metadata: Metadata = {
  title: "Change your password",
  description: "Replace the temporary password issued by an administrator.",
};

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
