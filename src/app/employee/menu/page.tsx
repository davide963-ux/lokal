import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { DishList } from "@/components/employee/dish-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireEmployeePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { listDishesForEmployee } from "@/lib/services/training";
import { cn } from "@/lib/utils";

export const metadata = { title: "Menu" };

export default async function EmployeeMenu({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const user = await requireEmployeePage();
  const { q, category } = await searchParams;
  const categoryId = category && /^[0-9a-f-]{36}$/i.test(category) ? category : undefined;
  const [dishes, categories] = await Promise.all([
    listDishesForEmployee(user.id, { q: q?.trim() || undefined, categoryId }),
    db.category.findMany({ where: { dishes: { some: { status: "PUBLISHED" } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const chip = (active: boolean) => cn("whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground");
  const qs = (c?: string) => { const p = new URLSearchParams(); if (q) p.set("q", q); if (c) p.set("category", c); const s = p.toString(); return `/employee/menu${s ? `?${s}` : ""}`; };

  return (
    <>
      <h1 className="text-3xl font-semibold">Menu</h1>
      <form action="/employee/menu" role="search" className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input name="q" defaultValue={q} placeholder="Search dishes" aria-label="Search dishes" enterKeyHint="search"
          className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        {categoryId && <input type="hidden" name="category" value={categoryId} />}
      </form>
      {categories.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={qs()} className={chip(!categoryId)}>All</Link>
          {categories.map((c) => <Link key={c.id} href={qs(c.id)} className={chip(categoryId === c.id)}>{c.name}</Link>)}
        </div>
      )}
      <div className="mt-5">
        {dishes.length === 0
          ? <EmptyState icon={BookOpen} title={q || categoryId ? "No dishes found" : "No dishes yet"} description={q || categoryId ? "Try a different search or category." : "Dishes will appear here once your manager publishes them."} />
          : <DishList dishes={dishes} />}
      </div>
    </>
  );
}
