import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { DishForm } from "../dish-form";
import { newKey, type DishFormState } from "../dish-form-state";
import { DishStatusBar, RevisionHistory } from "./dish-controls";

export const metadata = { title: "Edit dish" };
const STATUS_BADGE = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "neutral" } as const;

export default async function EditDishPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [dish, categories, allergens, library] = await Promise.all([
    db.dish.findUnique({
      where: { id },
      include: {
        ingredients: { include: { ingredient: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        allergens: true,
        revisions: { orderBy: { version: "desc" }, include: { _count: { select: { studyProgress: true } } } },
        _count: { select: { studyProgress: true } },
      },
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.allergen.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.ingredient.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  if (!dish) notFound();

  const initial: DishFormState = {
    name: dish.name, categoryId: dish.categoryId, shortDescription: dish.shortDescription ?? "", description: dish.description ?? "",
    price: dish.price ? dish.price.toFixed(2) : "", isAvailable: dish.isAvailable, imageUrl: dish.imageUrl,
    ingredients: dish.ingredients.map((i) => ({ key: newKey(), name: i.ingredient.name, quantity: i.quantity ?? "", isOptional: i.isOptional, isRemovable: i.isRemovable, substitutionNotes: i.substitutionNotes ?? "" })),
    allergens: Object.fromEntries(dish.allergens.map((a) => [a.allergenId, a.presence])),
    dietaryTags: dish.dietaryTags, crossContactWarnings: dish.crossContactWarnings ?? "", allergenNotes: dish.allergenNotes ?? "",
    // Pre-ticked only when already verified; any safety-relevant change on a live dish then forces a conscious re-tick.
    allergensVerified: !!dish.allergensVerifiedAt,
    cookingMethod: dish.cookingMethod ?? "", prepTimeMinutes: dish.prepTimeMinutes?.toString() ?? "", servingTemperature: dish.servingTemperature ?? "",
    garnishes: dish.garnishes ?? "", presentationDetails: dish.presentationDetails ?? "", preparationInstructions: dish.preparationInstructions ?? "",
    waiterDescription: dish.waiterDescription ?? "", recommendedPairings: dish.recommendedPairings ?? "", guestInformation: dish.guestInformation ?? "", managerNotes: dish.managerNotes ?? "",
    changeSummary: "", requiresRetraining: false,
  };

  return (
    <>
      <Link href="/admin/menu" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Menu</Link>
      <PageHeader
        title={dish.name}
        description={dish.currentVersion ? `Version ${dish.currentVersion} · ${dish._count.studyProgress} study record${dish._count.studyProgress === 1 ? "" : "s"}` : "Not published yet"}
        actions={<Badge variant={STATUS_BADGE[dish.status]}>{dish.status.toLowerCase()}</Badge>}
      />
      <DishStatusBar dishId={dish.id} status={dish.status} verified={!!dish.allergensVerifiedAt} hasHistory={dish._count.studyProgress > 0} />
      <DishForm dishId={dish.id} status={dish.status} initial={initial} categories={categories} allergens={allergens}
        ingredientLibrary={library.map((i) => i.name)} verifiedAt={dish.allergensVerifiedAt?.toISOString() ?? null} isPublished={dish.status === "PUBLISHED"} />
      <RevisionHistory dishId={dish.id} canFlag={dish.status === "PUBLISHED"}
        revisions={dish.revisions.map((r) => ({ id: r.id, version: r.version, summary: r.changeSummary, createdAt: r.createdAt.toISOString(), requiresRetraining: r.requiresRetraining, studied: r._count.studyProgress }))} />
    </>
  );
}
