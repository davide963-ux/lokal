import Link from "next/link";
import { cn } from "@/lib/utils";

export function TabLinks({ tabs, active }: { tabs: { id: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="tablist">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} role="tab" aria-selected={t.id === active}
          className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            t.id === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {t.label}{t.count !== undefined && <span className="text-xs text-muted-foreground">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
