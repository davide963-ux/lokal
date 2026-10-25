import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

/** Label + control + hint + error, wired with consistent spacing. */
export function Field({
  label, htmlFor, hint, error, required, children, className,
}: { label: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
