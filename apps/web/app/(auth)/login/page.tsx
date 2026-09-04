import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInScreen } from "@/app/(auth)/login/sign-in-screen";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Collega with your organization account.",
};

export default function LoginPage() {
  // The screen reads `?reason=` to say why the viewer is back here, and reading search
  // params is what would otherwise opt the whole route out of the static build.
  return (
    <Suspense fallback={null}>
      <SignInScreen />
    </Suspense>
  );
}
