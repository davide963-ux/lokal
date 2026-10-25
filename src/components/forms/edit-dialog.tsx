"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/components/use-action";
import type { ActionResult } from "@/lib/action";

/** Name (+ optional description) editor in a dialog. Used by categories, ingredients and allergens. */
export function EditNameDialog({
  open, onOpenChange, title, initial, withDescription, nameLabel = "Name", submitLabel = "Save", onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial: { name: string; description?: string | null };
  withDescription?: boolean;
  nameLabel?: string;
  submitLabel?: string;
  onSubmit: (v: { name: string; description: string | null }) => Promise<ActionResult>;
}) {
  const { run, pending } = useAction();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [error, setError] = useState<string>();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            run(() => onSubmit({ name, description: description || null }), {
              onSuccess: () => onOpenChange(false),
              onError: (r) => setError(r.fieldErrors?.name?.[0] ?? r.error),
            });
          }}
        >
          <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">{title}</DialogDescription></DialogHeader>
          <Field label={nameLabel} htmlFor="edit-name" required error={error}>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={80} />
          </Field>
          {withDescription && (
            <Field label="Description" htmlFor="edit-desc" hint="Optional">
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
