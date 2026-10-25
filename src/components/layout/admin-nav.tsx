"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Menu, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Items are added here as their pages ship; every entry must resolve to a real page.
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Icon className="size-[18px]" />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ brand, items, footer, children }: {
  brand: { name: string; logoUrl: string | null };
  items: NavItem[];
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card p-4 lg:flex">
        <BrandMark name={brand.name} logoUrl={brand.logoUrl} className="px-2 py-3" />
        <div className="mt-6 flex-1 overflow-y-auto"><NavLinks items={items} /></div>
        <div className="border-t border-border pt-4">{footer}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
        <BrandMark name={brand.name} logoUrl={brand.logoUrl} size={28} />
        <Button variant="ghost" size="icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></Button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-foreground/40 animate-in fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card p-4 shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between">
              <BrandMark name={brand.name} logoUrl={brand.logoUrl} size={28} />
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}><X /></Button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto"><NavLinks items={items} onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-border pt-4">{footer}</div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
