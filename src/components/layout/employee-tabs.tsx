"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Home, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/employee", label: "Home", icon: Home, match: (p) => p === "/employee" },
  { href: "/employee/menu", label: "Menu", icon: BookOpen, match: (p) => p.startsWith("/employee/menu") || p.startsWith("/employee/quiz") },
  { href: "/employee/results", label: "Results", icon: ClipboardList, match: (p) => p.startsWith("/employee/results") },
  { href: "/employee/account", label: "Account", icon: UserRound, match: (p) => p.startsWith("/employee/account") },
];

export function EmployeeTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("flex h-7 w-14 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}><Icon className="size-5" /></span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
