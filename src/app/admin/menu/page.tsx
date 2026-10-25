import Link from "next/link";
import { ChefHat, FolderTree, Plus, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import type { DishStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Menu" };

const STATUS_BADGE = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "neutral" } as const;

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  await requireAdminPage();
  const { q, status, category } = await searchParams;
  const statusFilter = (["DRAFT", "PUBLISHED", "ARCHIVED"] as const).find((s) => s === status) as DishStatus | undefined;
  const categoryFilter = category && /^[0-9a-f-]{36}$/i.test(category) ? category : undefined;

  const [dishes, categories, total] = await Promise.all([
    db.dish.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        // Archived dishes are hidden unless explicitly requested.
        status: statusFilter ?? { not: "ARCHIVED" },
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.dish.count(),
  ]);
  const filtering = !!(q || statusFilter || categoryFilter);

  return (
    <>
      <PageHeader
        title="Menu"
        description="Create and maintain the dishes your team learns."
        actions={<>
          <Button asChild variant="secondary"><Link href="/admin/menu/categories"><FolderTree />Categories</Link></Button>
          <Button asChild><Link href="/admin/menu/new"><Plus />New dish</Link></Button>
        </>}
      />

      <form action="/admin/menu" className="mb-5 grid gap-2 sm:grid-cols-[1fr_11rem_11rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Search dishes…" aria-label="Search dishes" />
        <Select name="category" defaultValue={categoryFilter ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="status" defaultValue={statusFilter ?? ""} aria-label="Status">
          <option value="">Active (not archived)</option>
          <option value="DRAFT">Drafts</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      {dishes.length === 0 ? (
        total === 0 ? (
          <EmptyState icon={ChefHat} title="Your menu is empty" description={categories.length ? "Add your first dish, with its ingredients, allergens and preparation notes." : "Start by creating a category such as “Starters”, then add your first dish."}
            action={<Button asChild><Link href={categories.length ? "/admin/menu/new" : "/admin/menu/categories"}>{categories.length ? "Create first dish" : "Create a category"}</Link></Button>} />
        ) : (
          <EmptyState icon={ChefHat} title="No dishes match" description={filtering ? "Try clearing the filters." : undefined} action={<Button asChild variant="secondary"><Link href="/admin/menu">Clear filters</Link></Button>} />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dishes.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/menu/${d.id}`} className="group flex gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-md">
                {d.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={d.imageUrl} alt="" className="size-20 shrink-0 rounded-md object-cover" />
                  : <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><ChefHat className="size-7" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium group-hover:text-primary">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.category.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS_BADGE[d.status]}>{d.status.toLowerCase()}</Badge>
                    {d.currentVersion > 0 && <Badge>v{d.currentVersion}</Badge>}
                    {!d.allergensVerifiedAt && <Badge variant="danger"><ShieldAlert className="size-3" />unverified</Badge>}
                    {!d.isAvailable && <Badge>sold out</Badge>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
