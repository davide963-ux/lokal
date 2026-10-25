import { Leaf } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TabLinks } from "@/components/layout/tab-links";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { AllergensManager, IngredientsManager } from "./ingredients-manager";

export const metadata = { title: "Ingredients" };

export default async function IngredientsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireAdminPage();
  const { tab, q } = await searchParams;
  const active = tab === "allergens" ? "allergens" : "ingredients";
  const [ingredients, allergens] = await Promise.all([
    db.ingredient.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      include: { _count: { select: { dishes: true } } },
    }),
    db.allergen.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { dishes: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Ingredients" description="Your shared ingredient library. Ingredients are also created automatically when you add them to a dish." />
      <TabLinks active={active} tabs={[
        { id: "ingredients", label: "Ingredients", href: "/admin/ingredients", count: ingredients.length },
        { id: "allergens", label: "Allergens", href: "/admin/ingredients?tab=allergens", count: allergens.length },
      ]} />
      {active === "ingredients" ? (
        <>
          <form className="mb-4" action="/admin/ingredients">
            <input name="q" defaultValue={q} placeholder="Search ingredients…" aria-label="Search ingredients"
              className="h-10 w-full max-w-sm rounded-md border border-input bg-card px-3 shadow-sm" />
          </form>
          {ingredients.length === 0 && q
            ? <EmptyState icon={Leaf} title="No matches" description={`Nothing matches “${q}”.`} />
            : <IngredientsManager rows={ingredients.map((i) => ({ id: i.id, name: i.name, description: i.description, used: i._count.dishes }))} />}
        </>
      ) : (
        <AllergensManager rows={allergens.map((a) => ({ id: a.id, name: a.name, used: a._count.dishes }))} />
      )}
    </>
  );
}
