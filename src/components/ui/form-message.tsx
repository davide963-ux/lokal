import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormMessage({ type, children }: { type: "error" | "success"; children?: React.ReactNode }) {
  if (!children) return null;
  const Icon = type === "error" ? AlertCircle : CheckCircle2;
  return (
    <div role={type === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-md px-3 py-2.5 text-sm",
      type === "error" ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success")}>
      <Icon className="mt-0.5 size-4 shrink-0" /><span>{children}</span>
    </div>
  );
}
