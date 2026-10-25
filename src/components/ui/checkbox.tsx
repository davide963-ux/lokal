import * as React from "react";
import { cn } from "@/lib/utils";

/** Native checkbox with a large touch target and the brand accent. */
export function Checkbox({ label, hint, className, ...props }: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-md py-1.5", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-[var(--primary)]" {...props} />
      <span className="text-sm leading-snug">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
