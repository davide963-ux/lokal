"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/components/use-action";
import { AccessLinkDialog } from "./access-link-dialog";
import { createEmployeeAction, type AccessLink } from "./actions";

export function AddEmployee() {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", email: "", jobTitle: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [link, setLink] = useState<AccessLink | null>(null);
  const err = (k: string) => errors[k]?.[0];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><UserPlus />Add employee</Button></DialogTrigger>
        <DialogContent>
          <form className="grid gap-4" onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            run(() => createEmployeeAction(v), {
              onSuccess: (r) => { setOpen(false); setV({ name: "", email: "", jobTitle: "", phone: "" }); if (r.data) setLink(r.data.link); },
              onError: (r) => setErrors(r.fieldErrors ?? { email: [r.error] }),
            });
          }}>
            <DialogHeader><DialogTitle>Add employee</DialogTitle><DialogDescription>You&apos;ll get a one-time link to send them so they can set their own password.</DialogDescription></DialogHeader>
            <Field label="Full name" htmlFor="en" required error={err("name")}><Input id="en" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={120} autoFocus /></Field>
            <Field label="Email" htmlFor="ee" required error={err("email")}><Input id="ee" type="email" inputMode="email" autoCapitalize="none" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title" htmlFor="ej" error={err("jobTitle")}><Input id="ej" value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} placeholder="Waiter" maxLength={80} /></Field>
              <Field label="Phone" htmlFor="ep" error={err("phone")}><Input id="ep" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Create &amp; get link</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AccessLinkDialog link={link} onClose={() => setLink(null)} />
    </>
  );
}
