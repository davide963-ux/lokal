import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; passwordSet?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/employee");
  const { callbackUrl, passwordSet } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to continue your training.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {passwordSet && <FormMessage type="success">Your password is set. You can sign in now.</FormMessage>}
        <LoginForm callbackUrl={callbackUrl} />
        <p className="text-center text-xs text-muted-foreground">
          No account yet, or forgot your password? Ask your manager for a link.
        </p>
      </CardContent>
    </Card>
  );
}
