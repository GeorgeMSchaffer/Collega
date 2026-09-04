import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { MockIdentityProvider } from "@/mocks";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Collega",
    template: "%s · Collega",
  },
  description: "Capture ideas, shape them into a roadmap, and deliver them.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The font classes define --font-geist-sans / --font-geist-mono, which globals.css
    // maps onto --font-sans / --font-mono. Fonts are self-hosted by the geist package,
    // so nothing is fetched at build or at render.
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      {/* The identity the mock answers as is chosen, not proved, and it has to be readable
          from every screen — so the provider sits at the root rather than in the desk
          shell. E1 replaces it with the real session; nothing below cares which it is. */}
      <body>
        <MockIdentityProvider>{children}</MockIdentityProvider>
      </body>
    </html>
  );
}
