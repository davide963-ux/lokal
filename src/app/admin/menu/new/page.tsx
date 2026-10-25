import Link from "next/link";
import { ArrowLeft, FolderTree } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { DishForm } from "../dish-form";
import { emptyDish } from "../dish-form-state";

export const metadata = { title: "New dish" };

export default async function NewDishPage() {
  await requireAdminPage();
  const [categories, allergens, ingredients] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.allergen.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.ingredient.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return (
    <>
      <Link href="/admin/menu" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Menu</Link>
      <PageHeader title="New dish" description="Saved as a draft. Employees only see it once you publish." />
      {categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="Create a category first" description="Every dish belongs to a category, like Starters or Desserts."
          action={<Button asChild><Link href="/admin/menu/categories">Create a category</Link></Button>} />
      ) : (
        <DishForm dishId={null} status={null} initial={emptyDish(categories.length === 1 ? categories[0]!.id : "")} categories={categories}
          allergens={allergens} ingredientLibrary={ingredients.map((i) => i.name)} verifiedAt={null} isPublished={false} />
      )}
    </>
  );
}
