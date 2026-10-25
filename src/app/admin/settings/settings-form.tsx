"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ImageUpload } from "@/components/forms/image-upload";
import { useAction } from "@/components/use-action";
import { LANGUAGES } from "@/lib/languages";
import { updateSettingsAction } from "./actions";

type Values = { name: string; description: string; address: string; contactEmail: string; contactPhone: string; preferredLanguage: string; logoUrl: string | null };

export function SettingsForm({ initial }: { initial: Values }) {
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const { run, pending } = useAction();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="grid max-w-3xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        run(() => updateSettingsAction(v), { onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <Card>
        <CardHeader><CardTitle>Identity</CardTitle><CardDescription>Shown on the sign-in page and in the navigation.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <Field label="Logo"><ImageUpload folder="branding" shape="square" value={v.logoUrl} onChange={(u) => set("logoUrl", u)} label="Logo" /></Field>
          <div className="grid gap-5">
            <Field label="Restaurant name" htmlFor="name" required error={errors.name?.[0]}>
              <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description?.[0]}>
              <Textarea id="description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} rows={3} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="contactEmail" error={errors.contactEmail?.[0]}>
            <Input id="contactEmail" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </Field>
          <Field label="Contact phone" htmlFor="contactPhone" error={errors.contactPhone?.[0]}>
            <Input id="contactPhone" type="tel" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2" error={errors.address?.[0]}>
            <Textarea id="address" value={v.address} onChange={(e) => set("address", e.target.value)} rows={2} maxLength={300} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Language</CardTitle><CardDescription>Sets the document language of the app.</CardDescription></CardHeader>
        <CardContent>
          <Field label="Preferred language" htmlFor="lang" className="max-w-xs">
            <Select id="lang" value={v.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div><Button type="submit" size="lg" loading={pending}>Save settings</Button></div>
    </form>
  );
}
