import { createHash } from "node:crypto";
import type { Tx } from "@/lib/db";

/** Everything an employee sees on a dish training page, frozen at a point in time. */
export type DishSnapshot = {
  name: string;
  category: string;
  imageUrl: string | null;
  shortDescription: string | null;
  description: string | null;
  price: string | null;
  isAvailable: boolean;
  ingredients: { name: string; quantity: string | null; isOptional: boolean; isRemovable: boolean; substitutionNotes: string | null }[];
  allergens: { name: string; presence: "CONTAINS" | "MAY_CONTAIN" }[];
  dietaryTags: string[];
  crossContactWarnings: string | null;
  allergenNotes: string | null;
  cookingMethod: string | null;
  preparationInstructions: string | null;
  prepTimeMinutes: number | null;
  servingTemperature: string | null;
  garnishes: string | null;
  presentationDetails: string | null;
  waiterDescription: string | null;
  recommendedPairings: string | null;
  guestInformation: string | null;
  managerNotes: string | null;
};

export async function buildDishSnapshot(tx: Tx, dishId: string): Promise<DishSnapshot> {
  const d = await tx.dish.findUniqueOrThrow({
    where: { id: dishId },
    include: {
      category: true,
      ingredients: { include: { ingredient: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      allergens: { include: { allergen: true } },
    },
  });
  return {
    name: d.name,
    category: d.category.name,
    imageUrl: d.imageUrl,
    shortDescription: d.shortDescription,
    description: d.description,
    price: d.price ? d.price.toFixed(2) : null,
    isAvailable: d.isAvailable,
    ingredients: d.ingredients.map((i) => ({
      name: i.ingredient.name,
      quantity: i.quantity,
      isOptional: i.isOptional,
      isRemovable: i.isRemovable,
      substitutionNotes: i.substitutionNotes,
    })),
    allergens: d.allergens
      .map((a) => ({ name: a.allergen.name, presence: a.presence }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    dietaryTags: [...d.dietaryTags].sort(),
    crossContactWarnings: d.crossContactWarnings,
    allergenNotes: d.allergenNotes,
    cookingMethod: d.cookingMethod,
    preparationInstructions: d.preparationInstructions,
    prepTimeMinutes: d.prepTimeMinutes,
    servingTemperature: d.servingTemperature,
    garnishes: d.garnishes,
    presentationDetails: d.presentationDetails,
    waiterDescription: d.waiterDescription,
    recommendedPairings: d.recommendedPairings,
    guestInformation: d.guestInformation,
    managerNotes: d.managerNotes,
  };
}

/** Stable content hash (key-order independent) used to detect "did anything actually change". */
export function snapshotHash(s: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)]))
    : v;
  return createHash("sha256").update(JSON.stringify(canon(s))).digest("hex");
}

const LABELS: Record<string, string> = {
  ingredients: "ingredients", allergens: "allergens", dietaryTags: "dietary information",
  crossContactWarnings: "cross-contact warnings", allergenNotes: "allergen notes", name: "name",
  category: "category", description: "description", shortDescription: "short description",
  price: "price", imageUrl: "photo", cookingMethod: "cooking method",
  preparationInstructions: "preparation", prepTimeMinutes: "preparation time",
  servingTemperature: "serving temperature", garnishes: "garnishes", presentationDetails: "presentation",
  waiterDescription: "service description", recommendedPairings: "recommended accompaniments",
  guestInformation: "guest information", managerNotes: "manager notes", isAvailable: "availability",
};

/** Human-readable list of the sections that differ, e.g. "ingredients, allergens". */
export function describeChanges(prev: DishSnapshot, next: DishSnapshot): string[] {
  return (Object.keys(LABELS) as (keyof DishSnapshot)[])
    .filter((k) => snapshotHash(prev[k]) !== snapshotHash(next[k]))
    .map((k) => LABELS[k]!);
}
