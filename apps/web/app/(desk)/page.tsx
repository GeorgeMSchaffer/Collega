import type { Metadata } from "next";

import { HomeScreen } from "@/app/(desk)/home-screen";

/**
 * `/` is Home, and Home lives in the desk group so it renders inside the shell.
 *
 * The route group `(desk)` contributes nothing to the URL, so a page here is still `/` — but
 * it is `/` *under* `(desk)/layout.tsx`, which is the whole point. Home is the one screen the
 * sidebar links to that is not under a path segment, and putting it outside the group is what
 * previously made the desk disappear when you opened it.
 */
export const metadata: Metadata = {
  title: "Home",
  description: "What needs you now, across the boards you can reach.",
};

export default function HomePage() {
  return <HomeScreen />;
}
