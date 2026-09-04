import Link from "next/link";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@collega/design-system";

// Placeholder home. E1 replaces it with the real entry screen; E0 only needs one route so
// the app boots and the theme can be seen applied.
export default function Home() {
  return (
    <div className="mx-auto max-w-2xl p-10">
      <Card>
        <CardHeader>
          <CardTitle>Collega</CardTitle>
          <CardDescription>
            The design system is in place. Screens land on top of it in E1
            through E6.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/kitchen-sink">Open the component reference</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
