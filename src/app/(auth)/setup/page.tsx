import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminExists, setupEnabled } from "@/lib/setup";
import { SetupForm } from "./setup-form";

export const metadata = { title: "First-time setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Invisible (404) unless the owner enabled it with SETUP_TOKEN, and gone for good once a manager exists.
  if (!setupEnabled() || (await adminExists())) notFound();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create the manager account</CardTitle>
        <CardDescription>One-time setup. You need the SETUP_TOKEN value from your deployment&apos;s environment variables.</CardDescription>
      </CardHeader>
      <CardContent><SetupForm /></CardContent>
    </Card>
  );
}
