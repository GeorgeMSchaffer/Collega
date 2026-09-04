import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

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
      <body>{children}</body>
    </html>
  );
}
