"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EditNameDialog } from "@/components/forms/edit-dialog";
import { useAction } from "@/components/use-action";
import { createCategoryAction, deleteCategoryAction, moveCategoryAction, updateCategoryAction } from "../actions";

type Row = { id: string; name: string; description: string | null; count: number };

export function CategoriesManager({ rows }: { rows: Row[] }) {
  const { run, pending } = useAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  return (
    <div className="space-y-4">
      <Button onClick={() => setAdding(true)}><Plus />Add category</Button>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No categories yet. Add one (for example “Starters” or “Desserts”) before creating dishes.</p>}
      <Card><ul className="divide-y divide-border">
        {rows.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-3 sm:px-4">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${c.name} up`} disabled={i === 0 || pending} onClick={() => run(() => moveCategoryAction(c.id, "up"), { success: false })}><ArrowUp className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${c.name} down`} disabled={i === rows.length - 1 || pending} onClick={() => run(() => moveCategoryAction(c.id, "down"), { success: false })}><ArrowDown className="size-3.5" /></Button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
            </div>
            <Badge variant={c.count ? "primary" : "neutral"}>{c.count} {c.count === 1 ? "dish" : "dishes"}</Badge>
            <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
            <ConfirmButton variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`Delete ${c.name}`}
              title={`Delete “${c.name}”?`} description={c.count ? "This category still has dishes, so deletion will be refused." : "This cannot be undone."}
              confirmLabel="Delete" destructive onConfirm={() => run(() => deleteCategoryAction(c.id))}><Trash2 /></ConfirmButton>
          </li>
        ))}
      </ul></Card>
      {adding && <EditNameDialog open onOpenChange={setAdding} title="New category" initial={{ name: "" }} withDescription submitLabel="Add category" onSubmit={(v) => createCategoryAction(v)} />}
      {editing && <EditNameDialog open onOpenChange={(o) => !o && setEditing(null)} title={`Edit ${editing.name}`} initial={editing} withDescription onSubmit={(v) => updateCategoryAction(editing.id, v)} />}
    </div>
  );
}
