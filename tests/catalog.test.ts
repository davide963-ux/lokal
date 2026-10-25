import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createAllergen, createCategory, createIngredient, deleteAllergen, deleteCategory,
  deleteIngredient, moveCategory, renameAllergen, updateCategory, updateIngredient,
} from "@/lib/services/catalog";
import { createDish } from "@/lib/services/dishes";
import { makeCategory, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("categories", () => {
  it("are dynamic, unique case-insensitively, and ordered", async () => {
    const a = await createCategory({ name: "Starters" });
    const b = await createCategory({ name: "Mains" });
    expect([a.sortOrder, b.sortOrder]).toEqual([0, 1]);
    await expect(createCategory({ name: "starters" })).rejects.toThrow(/already exists/);
    await expect(updateCategory(b.id, { name: "STARTERS" })).rejects.toThrow(/already exists/);
    await updateCategory(b.id, { name: "Main Courses", description: "Big plates" });
  });
  it("move up/down swaps neighbours and ignores the edges", async () => {
    const [a, b, c] = [await createCategory({ name: "A" }), await createCategory({ name: "B" }), await createCategory({ name: "C" })];
    await moveCategory(c.id, "up");
    await moveCategory(a.id, "up"); // already first: no-op
    const order = (await db.category.findMany({ orderBy: { sortOrder: "asc" } })).map((x) => x.name);
    expect(order).toEqual(["A", "C", "B"]);
    expect(b.id).toBeTruthy();
  });
  it("cannot be deleted while dishes use them", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const cat = await makeCategory("Pasta");
    await createDish(admin.id, { name: "Penne", categoryId: cat.id });
    await expect(deleteCategory(cat.id)).rejects.toThrow(/still has 1 dish/);
    const empty = await createCategory({ name: "Empty" });
    await deleteCategory(empty.id);
    expect(await db.category.count()).toBe(1);
  });
});

describe("ingredients", () => {
  it("unique, editable, and protected from deletion while in use", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const cat = await makeCategory();
    const egg = await createIngredient({ name: "Egg" });
    await expect(createIngredient({ name: "egg" })).rejects.toThrow(/already exists/);
    await updateIngredient(egg.id, { name: "Free-range egg", description: "Local" });
    await createDish(admin.id, { name: "Omelette", categoryId: cat.id, ingredients: [{ name: "free-range EGG" }] });
    await expect(deleteIngredient(egg.id)).rejects.toThrow(/used by 1 dish/);
    const salt = await createIngredient({ name: "Salt" });
    await deleteIngredient(salt.id);
  });
});

describe("allergens", () => {
  it("managers can extend the vocabulary; in-use allergens are protected", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const cat = await makeCategory();
    const al = await createAllergen({ name: "Kiwi" });
    await expect(createAllergen({ name: "kiwi" })).rejects.toThrow(/already exists/);
    await renameAllergen(al.id, { name: "Kiwi fruit" });
    await createDish(admin.id, { name: "Fruit bowl", categoryId: cat.id, allergens: [{ allergenId: al.id, presence: "MAY_CONTAIN" }] });
    await expect(deleteAllergen(al.id)).rejects.toThrow(/assigned to 1 dish/);
  });
});
