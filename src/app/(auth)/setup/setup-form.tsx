"use client";

import { useActionState, useState } from "react";
import { setupAction } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, undefined);
  // Controlled: React resets uncontrolled fields after a failed action, which would wipe what was typed.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);
  return (
    <form action={action} className="space-y-4" autoComplete="off">
      <Field label="Setup token" htmlFor="token"><Input id="token" name="token" type="password" required autoComplete="off" /></Field>
      <Field label="Your name" htmlFor="name" error={err("name")}><Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" /></Field>
      <Field label="Email (used to sign in)" htmlFor="email" error={err("email")}><Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="none" required autoComplete="username" /></Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters, with letters and numbers." error={err("password")}><Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></Field>
      <Field label="Confirm password" htmlFor="confirm" error={err("confirm")}><Input id="confirm" name="confirm" type="password" required autoComplete="new-password" /></Field>
      {state && !state.ok && !state.fieldErrors && <FormMessage type="error">{state.error}</FormMessage>}
      <Button type="submit" className="w-full" size="lg" loading={pending}>Create manager account</Button>
    </form>
  );
}
