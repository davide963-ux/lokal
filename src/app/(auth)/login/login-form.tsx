"use client";

import { useActionState, useState } from "react";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  // Controlled so a failed attempt (React resets uncontrolled fields after an action) keeps the email.
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="space-y-4">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state && !state.ok && <FormMessage type="error">{state.error}</FormMessage>}
      <Button type="submit" className="w-full" size="lg" loading={pending}>Sign in</Button>
    </form>
  );
}
