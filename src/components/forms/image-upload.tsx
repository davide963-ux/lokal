"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadImageAction } from "@/app/admin/upload-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024;

export function ImageUpload({
  folder, value, onChange, className, shape = "wide", label = "Upload photo",
}: {
  folder: "dishes" | "branding";
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
  shape?: "wide" | "square";
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    // Cheap client-side pre-checks for fast feedback; the server re-validates by file content.
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return void toast.error("Use a JPEG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return void toast.error("Image is too large (max 4 MB).");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadImageAction(folder, fd);
      if (res.ok && res.data) onChange(res.data.url);
      else if (!res.ok) toast.error(res.error);
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={label}
        onChange={(e) => onFile(e.target.files?.[0])} />
      <div className={cn("relative overflow-hidden rounded-lg border border-dashed border-input bg-muted/40",
        shape === "wide" ? "aspect-[16/10] w-full" : "size-28")}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={label}
            className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ImagePlus className="size-6" />{shape === "wide" && <span>{label}</span>}
          </button>
        )}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-card/70"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      </div>
      {value && (
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy}>Replace</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={busy}><Trash2 />Remove</Button>
        </div>
      )}
    </div>
  );
}
