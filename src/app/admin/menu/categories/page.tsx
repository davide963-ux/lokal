import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { CategoriesManager } from "./categories-manager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdminPage();
  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { dishes: true } } } });
  return (
    <>
      <Link href="/admin/menu" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Menu</Link>
      <PageHeader title="Categories" description="Group dishes the way your menu is organised. The order here is the order employees see." />
      <CategoriesManager rows={categories.map((c) => ({ id: c.id, name: c.name, description: c.description, count: c._count.dishes }))} />
    </>
  );
}
