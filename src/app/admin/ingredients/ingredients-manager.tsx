"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { EditNameDialog } from "@/components/forms/edit-dialog";
import { useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import {
  createAllergenAction, createIngredientAction, deleteAllergenAction, deleteIngredientAction,
  renameAllergenAction, updateIngredientAction,
} from "./actions";

type Row = { id: string; name: string; description?: string | null; used: number };

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => Promise<import("@/lib/action").ActionResult> }) {
  const { run, pending } = useAction();
  const [name, setName] = useState("");
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => onAdd(name), { onSuccess: () => setName("") }); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={80} required />
      <Button type="submit" loading={pending}><Plus />Add</Button>
    </form>
  );
}

function ManagedRow({ row, usedLabel, withDescription, onSave, onDelete }: {
  row: Row; usedLabel: string; withDescription?: boolean;
  onSave: (v: { name: string; description: string | null }) => Promise<import("@/lib/action").ActionResult>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.name}</p>
        {row.description && <p className="truncate text-xs text-muted-foreground">{row.description}</p>}
      </div>
      <Badge variant={row.used ? "primary" : "neutral"}>{row.used} {usedLabel}</Badge>
      <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit ${row.name}`} onClick={() => setEditing(true)}><Pencil /></Button>
      <ConfirmButton variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`Delete ${row.name}`}
        title={`Delete “${row.name}”?`} description={row.used ? "It is in use, so this will be refused. Remove it from dishes first." : "This cannot be undone."}
        confirmLabel="Delete" destructive onConfirm={onDelete}><Trash2 /></ConfirmButton>
      {editing && <EditNameDialog open onOpenChange={setEditing} title={`Edit ${row.name}`} initial={row} withDescription={withDescription} onSubmit={onSave} />}
    </li>
  );
}

export function IngredientsManager({ rows }: { rows: Row[] }) {
  const { run } = useAction();
  return (
    <div className="space-y-4">
      <AddRow placeholder="New ingredient (e.g. Guanciale)" onAdd={(name) => createIngredientAction({ name })} />
      <Card><ul className="divide-y divide-border">
        {rows.map((r) => (
          <ManagedRow key={r.id} row={r} usedLabel={r.used === 1 ? "dish" : "dishes"} withDescription
            onSave={(v) => updateIngredientAction(r.id, v)} onDelete={() => run(() => deleteIngredientAction(r.id))} />
        ))}
      </ul></Card>
    </div>
  );
}

export function AllergensManager({ rows }: { rows: Row[] }) {
  const { run } = useAction();
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-warning-soft px-3 py-2.5 text-sm text-warning">
        This is the list of allergens managers can tick on a dish. It starts with the 14 major allergens. Which allergens a dish contains is always entered and verified by a manager.
      </p>
      <AddRow placeholder="Add another allergen" onAdd={(name) => createAllergenAction({ name })} />
      <Card><ul className="divide-y divide-border">
        {rows.map((r) => (
          <ManagedRow key={r.id} row={r} usedLabel={r.used === 1 ? "dish" : "dishes"}
            onSave={(v) => renameAllergenAction(r.id, { name: v.name })} onDelete={() => run(() => deleteAllergenAction(r.id))} />
        ))}
      </ul></Card>
    </div>
  );
}
