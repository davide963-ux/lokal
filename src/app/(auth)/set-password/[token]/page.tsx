import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { findValidToken } from "@/lib/tokens";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Set your password" };

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = await findValidToken(raw);

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Link expired</CardTitle>
          <CardDescription>This link is invalid, has already been used, or has expired. Ask your manager to send you a new one.</CardDescription>
        </CardHeader>
        <CardContent><Button asChild variant="secondary" className="w-full"><Link href="/login">Back to sign in</Link></Button></CardContent>
      </Card>
    );
  }
  const invite = token.purpose === "INVITE";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{invite ? `Welcome, ${token.user.name.split(" ")[0]}` : "Reset your password"}</CardTitle>
        <CardDescription>{invite ? "Choose a password to activate your account." : `Choose a new password for ${token.user.email}.`}</CardDescription>
      </CardHeader>
      <CardContent><SetPasswordForm token={raw} /></CardContent>
    </Card>
  );
}
