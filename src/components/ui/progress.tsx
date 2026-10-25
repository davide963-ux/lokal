import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "warning" | "danger" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = { primary: "bg-primary", warning: "bg-warning", danger: "bg-destructive" }[tone];
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", color)} style={{ width: `${v}%` }} />
    </div>
  );
}
