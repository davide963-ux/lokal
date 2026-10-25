"use client";

import { Archive, ArchiveRestore, EyeOff, History, Rocket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useAction } from "@/components/use-action";
import {
  archiveDishAction, deleteDishAction, publishDishAction, restoreDishAction, setRetrainingAction, unpublishDishAction,
} from "../actions";

export function DishStatusBar({ dishId, status, verified, hasHistory }: { dishId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; verified: boolean; hasHistory: boolean }) {
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-card">
      {status === "DRAFT" && (
        <ConfirmButton loading={pending} disabled={!verified} title="Publish this dish?" confirmLabel="Publish"
          description="Employees will be notified and can start studying it. Unsaved edits below are not included. Save first."
          onConfirm={() => run(() => publishDishAction(dishId))}><Rocket />Publish</ConfirmButton>
      )}
      {status === "DRAFT" && !verified && <span className="text-xs text-warning">Verify allergen information and save before publishing.</span>}
      {status === "PUBLISHED" && (
        <ConfirmButton variant="secondary" loading={pending} title="Unpublish this dish?" confirmLabel="Unpublish"
          description="Employees will no longer see it. Their study and quiz history is kept."
          onConfirm={() => run(() => unpublishDishAction(dishId))}><EyeOff />Unpublish</ConfirmButton>
      )}
      {status !== "ARCHIVED" ? (
        <ConfirmButton variant="secondary" loading={pending} title="Archive this dish?" confirmLabel="Archive"
          description="It disappears from the active menu but stays available for historical training records."
          onConfirm={() => run(() => archiveDishAction(dishId))}><Archive />Archive</ConfirmButton>
      ) : (
        <Button variant="secondary" loading={pending} onClick={() => run(() => restoreDishAction(dishId))}><ArchiveRestore />Restore as draft</Button>
      )}
      <ConfirmButton variant="ghost" className="ml-auto text-destructive" disabled={pending} destructive title="Delete this dish permanently?" confirmLabel="Delete"
        description={hasHistory ? "This dish has employee training history, so deletion will be refused. Archive it instead." : "This cannot be undone."}
        onConfirm={() => run(() => deleteDishAction(dishId), { onSuccess: () => router.push("/admin/menu"), refresh: false })}><Trash2 />Delete</ConfirmButton>
    </div>
  );
}

export function RevisionHistory({ dishId, canFlag, revisions }: {
  dishId: string; canFlag: boolean;
  revisions: { id: string; version: number; summary: string | null; createdAt: string; requiresRetraining: boolean; studied: number }[];
}) {
  const { run, pending } = useAction();
  if (revisions.length === 0) return null;
  return (
    <Card className="mt-2">
      <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5 text-muted-foreground" />Version history</CardTitle>
        <CardDescription>Every published change is kept, so quiz results stay tied to the content that was taught.</CardDescription></CardHeader>
      <CardContent>
        <ol className="divide-y divide-border">
          {revisions.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <Badge variant={i === 0 ? "primary" : "neutral"}>v{r.version}</Badge>
              <span className="min-w-0 flex-1 text-sm">{r.summary ?? "Updated"}</span>
              {r.requiresRetraining && <Badge variant="warning">retraining required</Badge>}
              <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()} · {r.studied} studied</span>
              {i === 0 && canFlag && r.version > 1 && (
                <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setRetrainingAction(dishId, !r.requiresRetraining))}>
                  {r.requiresRetraining ? "Remove requirement" : "Require retraining"}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
