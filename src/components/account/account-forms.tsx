"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/components/use-action";
import { changePasswordAction, updateProfileAction } from "@/app/admin/account/actions";

export function AccountForms({ name, email, phone }: { name: string; email: string; phone: string }) {
  const profile = useAction();
  const pw = useAction();
  const [v, setV] = useState({ name, phone });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle><CardDescription>{email}</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); setErrors({}); profile.run(() => updateProfileAction(v), { onError: (r) => setErrors(r.fieldErrors ?? {}) }); }}>
            <Field label="Full name" htmlFor="pname" required error={errors.name?.[0]}><Input id="pname" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={120} autoComplete="name" /></Field>
            <Field label="Phone" htmlFor="pphone" error={errors.phone?.[0]}><Input id="pphone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} autoComplete="tel" /></Field>
            <div><Button type="submit" loading={profile.pending}>Save profile</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle><CardDescription>You will be signed out on all devices and asked to sign in again.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (mismatch) return; pw.run(() => changePasswordAction(cur, next), { success: false, refresh: false }); }}>
            <Field label="Current password" htmlFor="cur"><Input id="cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
            <Field label="New password" htmlFor="new" hint="At least 10 characters, with letters and numbers."><Input id="new" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
            <Field label="Confirm new password" htmlFor="conf" error={mismatch ? "Passwords do not match" : undefined}><Input id="conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} /></Field>
            <div><Button type="submit" variant="secondary" loading={pw.pending} disabled={mismatch}>Update password</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
