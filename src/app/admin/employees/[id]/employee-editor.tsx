"use client";

import { KeyRound, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/components/use-action";
import { AccessLinkDialog } from "../access-link-dialog";
import {
  deactivateEmployeeAction, issueAccessLinkAction, reactivateEmployeeAction, updateEmployeeAction, type AccessLink,
} from "../actions";

export function EmployeeEditor({ id, status, initial }: { id: string; status: "ACTIVE" | "INVITED" | "INACTIVE"; initial: { name: string; email: string; jobTitle: string; phone: string } }) {
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [link, setLink] = useState<AccessLink | null>(null);
  const err = (k: string) => errors[k]?.[0];

  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErrors({}); run(() => updateEmployeeAction(id, v), { onError: (r) => setErrors(r.fieldErrors ?? { email: [r.error] }) }); }}>
            <Field label="Full name" htmlFor="n" required error={err("name")}><Input id="n" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={120} /></Field>
            <Field label="Email" htmlFor="e" required error={err("email")}><Input id="e" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></Field>
            <Field label="Job title" htmlFor="j" error={err("jobTitle")}><Input id="j" value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} maxLength={80} /></Field>
            <Field label="Phone" htmlFor="p" error={err("phone")}><Input id="p" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={pending}>Save details</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Access</CardTitle>
          <CardDescription>{status === "INVITED" ? "This person hasn't set a password yet." : status === "ACTIVE" ? "Create a link so this person can choose a new password. Their current password keeps working until they use it." : "This account is deactivated and cannot sign in."}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {status !== "INACTIVE" && (
            <Button variant="secondary" loading={pending} onClick={() => run(() => issueAccessLinkAction(id), { success: false, refresh: false, onSuccess: (r) => r.data && setLink(r.data.link) })}>
              <KeyRound />{status === "INVITED" ? "New invitation link" : "Create password reset link"}
            </Button>
          )}
          {status === "INACTIVE" ? (
            <Button loading={pending} onClick={() => run(() => reactivateEmployeeAction(id))}><UserCheck />Reactivate</Button>
          ) : (
            <ConfirmButton variant="secondary" className="text-destructive" disabled={pending} destructive title="Deactivate this employee?" confirmLabel="Deactivate"
              description="They are signed out immediately and cannot sign in again. Their training history is kept, and you can reactivate them later."
              onConfirm={() => run(() => deactivateEmployeeAction(id))}><UserX />Deactivate</ConfirmButton>
          )}
        </CardContent>
      </Card>
      <AccessLinkDialog link={link} onClose={() => setLink(null)} />
    </div>
  );
}
