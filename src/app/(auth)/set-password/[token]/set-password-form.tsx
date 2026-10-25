"use client";

import { useActionState } from "react";
import { setPasswordAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, undefined);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" hint="At least 10 characters, with letters and numbers." error={err("password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} aria-invalid={!!err("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={!!err("confirm")} />
      </Field>
      {state && !state.ok && !state.fieldErrors && <FormMessage type="error">{state.error}</FormMessage>}
      <Button type="submit" className="w-full" size="lg" loading={pending}>Save password</Button>
    </form>
  );
}
