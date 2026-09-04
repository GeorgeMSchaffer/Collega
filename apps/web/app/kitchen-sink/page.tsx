import type { Metadata } from "next";

import { KitchenSink } from "./kitchen-sink";

export const metadata: Metadata = { title: "Component reference" };

export default function KitchenSinkPage() {
  return <KitchenSink />;
}
