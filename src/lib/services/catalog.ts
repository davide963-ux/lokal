import { z } from "zod";
import { db } from "@/lib/db";
import { optText, reqText } from "@/lib/validation/common";
import { DomainError } from "@/lib/errors";

// ───────── Categories ─────────
export const categoryInput = z.object({ name: reqText("Category name", 60), description: optText(200) });

async function assertUniqueName(model: "category" | "ingredient" | "allergen", name: string, exceptId?: string) {
  const where = { name: { equals: name, mode: "insensitive" as const }, ...(exceptId ? { id: { not: exceptId } } : {}) };
  const clash =
    model === "category" ? await db.category.findFirst({ where })
    : model === "ingredient" ? await db.ingredient.findFirst({ where })
    : await db.allergen.findFirst({ where });
  if (clash) throw new DomainError(`"${name}" already exists.`);
}

export async function createCategory(raw: z.input<typeof categoryInput>) {
  const input = categoryInput.parse(raw);
  await assertUniqueName("category", input.name);
  const last = await db.category.aggregate({ _max: { sortOrder: true } });
  return db.category.create({ data: { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
}

export async function updateCategory(id: string, raw: z.input<typeof categoryInput>) {
  const input = categoryInput.parse(raw);
  await assertUniqueName("category", input.name, id);
  return db.category.update({ where: { id }, data: input });
}

export async function deleteCategory(id: string) {
  const count = await db.dish.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new DomainError(`This category still has ${count} dish${count === 1 ? "" : "es"}. Move or delete them first.`);
  }
  await db.category.delete({ where: { id } });
}

/** Swaps position with the neighbour; renumbers 0..n-1 so the order is always gap-free. */
export async function moveCategory(id: string, direction: "up" | "down") {
  await db.$transaction(async (tx) => {
    const all = await tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
    const i = all.findIndex((c) => c.id === id);
    if (i < 0) throw new DomainError("Category not found.");
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j]!, all[i]!];
    for (const [idx, c] of all.entries()) await tx.category.update({ where: { id: c.id }, data: { sortOrder: idx } });
  });
}

// ───────── Ingredients ─────────
export const ingredientInput = z.object({ name: reqText("Ingredient name", 80), description: optText(300) });

export async function createIngredient(raw: z.input<typeof ingredientInput>) {
  const input = ingredientInput.parse(raw);
  await assertUniqueName("ingredient", input.name);
  return db.ingredient.create({ data: input });
}

export async function updateIngredient(id: string, raw: z.input<typeof ingredientInput>) {
  const input = ingredientInput.parse(raw);
  await assertUniqueName("ingredient", input.name, id);
  return db.ingredient.update({ where: { id }, data: input });
}

export async function deleteIngredient(id: string) {
  const used = await db.dishIngredient.count({ where: { ingredientId: id } });
  if (used > 0) throw new DomainError(`This ingredient is used by ${used} dish${used === 1 ? "" : "es"}. Remove it from them first.`);
  await db.ingredient.delete({ where: { id } });
}

// ───────── Allergens (the vocabulary managers pick from) ─────────
export const allergenInput = z.object({ name: reqText("Allergen name", 60) });

export async function createAllergen(raw: z.input<typeof allergenInput>) {
  const input = allergenInput.parse(raw);
  await assertUniqueName("allergen", input.name);
  const last = await db.allergen.aggregate({ _max: { sortOrder: true } });
  return db.allergen.create({ data: { name: input.name, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
}

export async function renameAllergen(id: string, raw: z.input<typeof allergenInput>) {
  const input = allergenInput.parse(raw);
  await assertUniqueName("allergen", input.name, id);
  return db.allergen.update({ where: { id }, data: { name: input.name } });
}

export async function deleteAllergen(id: string) {
  const used = await db.dishAllergen.count({ where: { allergenId: id } });
  if (used > 0) throw new DomainError(`This allergen is assigned to ${used} dish${used === 1 ? "" : "es"}. Remove it from them first.`);
  await db.allergen.delete({ where: { id } });
}
