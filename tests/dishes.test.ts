import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  archiveDish, createDish, deleteDish, DomainError, publishDish, restoreDish,
  setLatestRevisionRetraining, unpublishDish, updateDish,
} from "@/lib/services/dishes";
import type { DishFormInput } from "@/lib/validation/dish";
import { makeAllergen, makeCategory, makeUser, resetDb } from "./helpers";

let adminId: string;
let categoryId: string;

const base = (over: Partial<DishFormInput> = {}): DishFormInput => ({
  name: "Spaghetti Carbonara",
  categoryId,
  ingredients: [{ name: "Spaghetti", isOptional: false, isRemovable: false }, { name: "Guanciale", isOptional: false, isRemovable: false }],
  allergensVerified: true,
  ...over,
});

beforeEach(async () => {
  await resetDb();
  adminId = (await makeUser({ role: "ADMIN" })).id;
  categoryId = (await makeCategory()).id;
});

describe("dish creation", () => {
  it("requires only name and category; everything else is optional", async () => {
    const { id } = await createDish(adminId, { name: "Water", categoryId });
    const d = await db.dish.findUniqueOrThrow({ where: { id } });
    expect(d).toMatchObject({ status: "DRAFT", description: null, price: null, allergensVerifiedAt: null });
  });
  it("rejects missing name, bad category, negative price and javascript: image URLs", async () => {
    await expect(createDish(adminId, { name: "  ", categoryId })).rejects.toThrow();
    await expect(createDish(adminId, { name: "X", categoryId: "00000000-0000-4000-8000-000000000000" })).rejects.toBeInstanceOf(DomainError);
    await expect(createDish(adminId, { name: "X", categoryId, price: -1 })).rejects.toThrow();
    await expect(createDish(adminId, { name: "X", categoryId, imageUrl: "javascript:alert(1)" })).rejects.toThrow();
  });
  it("reuses library ingredients case-insensitively and creates new ones", async () => {
    await db.ingredient.create({ data: { name: "Guanciale" } });
    await createDish(adminId, base({ ingredients: [{ name: "guanciale", isOptional: false, isRemovable: false }, { name: "Pecorino", isOptional: true, isRemovable: true, substitutionNotes: "Parmesan" }] }));
    expect(await db.ingredient.count()).toBe(2);
    const link = await db.dishIngredient.findFirstOrThrow({ where: { ingredient: { name: "Pecorino" } } });
    expect(link).toMatchObject({ isOptional: true, isRemovable: true, substitutionNotes: "Parmesan" });
  });
  it("rejects the same ingredient twice in one dish", async () => {
    await expect(createDish(adminId, base({ ingredients: [{ name: "Egg", isOptional: false, isRemovable: false }, { name: "EGG", isOptional: false, isRemovable: false }] }))).rejects.toBeInstanceOf(DomainError);
    expect(await db.dish.count()).toBe(0); // transaction rolled back
  });
  it("stores allergens with presence and records who verified", async () => {
    const eggs = await makeAllergen("Eggs");
    const { id } = await createDish(adminId, base({ allergens: [{ allergenId: eggs.id, presence: "CONTAINS" }] }));
    const d = await db.dish.findUniqueOrThrow({ where: { id }, include: { allergens: true } });
    expect(d.allergens[0]).toMatchObject({ allergenId: eggs.id, presence: "CONTAINS" });
    expect(d).toMatchObject({ allergensVerifiedById: adminId });
    expect(d.allergensVerifiedAt).not.toBeNull();
  });
});

describe("publishing", () => {
  it("cannot publish until allergen info is manager-verified", async () => {
    const { id } = await createDish(adminId, base({ allergensVerified: false }));
    await expect(publishDish(adminId, id)).rejects.toThrow(/Verify the allergen/);
    expect((await db.dish.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });
  it("publish creates revision v1, sets publishedAt and notifies active employees once", async () => {
    const emp = await makeUser();
    await makeUser({ status: "INACTIVE" });
    const { id } = await createDish(adminId, base());
    const res = await publishDish(adminId, id);
    expect(res.revision).toEqual({ version: 1, requiresRetraining: false });
    const d = await db.dish.findUniqueOrThrow({ where: { id } });
    expect(d).toMatchObject({ status: "PUBLISHED", currentVersion: 1 });
    expect(d.publishedAt).not.toBeNull();
    const notes = await db.notification.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ userId: emp.id, type: "DISH_PUBLISHED" });
    await expect(publishDish(adminId, id)).rejects.toThrow(/already published/);
  });
  it("unpublish → republish unchanged creates no new revision and no new announcement", async () => {
    await makeUser();
    const { id } = await createDish(adminId, base());
    await publishDish(adminId, id);
    await unpublishDish(id);
    expect((await publishDish(adminId, id)).revision).toBeNull();
    expect(await db.dishRevision.count()).toBe(1);
    expect(await db.notification.count()).toBe(1);
  });
  it("archive/restore round-trip; archived dishes cannot be edited or published", async () => {
    const { id } = await createDish(adminId, base());
    await publishDish(adminId, id);
    await archiveDish(id);
    await expect(updateDish(adminId, id, base())).rejects.toThrow(/Restore/);
    await expect(publishDish(adminId, id)).rejects.toThrow(/Restore/);
    await restoreDish(id);
    expect((await db.dish.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });
});

describe("revisions & retraining", () => {
  async function publishedDish() {
    const { id } = await createDish(adminId, base());
    await publishDish(adminId, id);
    return id;
  }
  it("draft edits create no revision; published edits create one only when content changed", async () => {
    const { id } = await createDish(adminId, base());
    await updateDish(adminId, id, base({ description: "draft change" }));
    expect(await db.dishRevision.count()).toBe(0);
    await publishDish(adminId, id);
    expect((await updateDish(adminId, id, base({ description: "draft change" }))).revision).toBeNull(); // identical
    const res = await updateDish(adminId, id, base({ description: "draft change", garnishes: "Black pepper" }));
    expect(res.revision?.version).toBe(2);
    const revs = await db.dishRevision.findMany({ orderBy: { version: "asc" } });
    expect(revs).toHaveLength(2);
    expect(revs[1]!.changeSummary).toMatch(/garnishes/);
    // history preserved: v1 snapshot still has the original content
    expect((revs[0]!.snapshot as { garnishes: string | null }).garnishes).toBeNull();
  });
  it("changing an ingredient on a published dish requires re-verification", async () => {
    const id = await publishedDish();
    const changed = base({ ingredients: [{ name: "Spaghetti", isOptional: false, isRemovable: false }, { name: "Cream", isOptional: false, isRemovable: false }], allergensVerified: false });
    await expect(updateDish(adminId, id, changed)).rejects.toThrow(/Confirm that you have verified/);
    // rolled back entirely
    expect(await db.dishIngredient.count({ where: { dishId: id, ingredient: { name: "Cream" } } })).toBe(0);
    expect((await db.dish.findUniqueOrThrow({ where: { id } })).allergensVerifiedAt).not.toBeNull();
    const ok = await updateDish(adminId, id, { ...changed, allergensVerified: true });
    expect(ok.revision?.version).toBe(2);
  });
  it("non-safety edits keep the existing verification", async () => {
    const id = await publishedDish();
    const res = await updateDish(adminId, id, base({ allergensVerified: false, waiterDescription: "Creamy without cream" }));
    expect(res.revision?.version).toBe(2);
  });
  it("requiresRetraining notifies employees who studied it; others get a normal update notice; admins are told", async () => {
    const studied = await makeUser({ name: "Studied" });
    const never = await makeUser({ name: "Never" });
    const id = await publishedDish();
    await db.notification.deleteMany();
    const rev = await db.dishRevision.findFirstOrThrow({ where: { dishId: id } });
    await db.dishStudyProgress.create({ data: { userId: studied.id, dishId: id, dishRevisionId: rev.id } });

    const res = await updateDish(adminId, id, base({ garnishes: "Basil", requiresRetraining: true, changeSummary: "New garnish" }));
    expect(res.revision).toEqual({ version: 2, requiresRetraining: true });
    const notes = await db.notification.findMany();
    const byUser = Object.fromEntries(notes.map((n) => [n.userId, n.type]));
    expect(byUser[studied.id]).toBe("RETRAINING_REQUIRED");
    expect(byUser[never.id]).toBe("DISH_UPDATED");
    expect(byUser[adminId]).toBe("RETRAINING_PENDING");
    expect((await db.dishRevision.findFirstOrThrow({ where: { dishId: id, version: 2 } })).changeSummary).toBe("New garnish");
  });
  it("setLatestRevisionRetraining flags after the fact, only for updated dishes", async () => {
    const id = await publishedDish();
    await expect(setLatestRevisionRetraining(id, true)).rejects.toThrow(/no updated version/);
    await updateDish(adminId, id, base({ garnishes: "Basil" }));
    await setLatestRevisionRetraining(id, true);
    expect((await db.dishRevision.findFirstOrThrow({ where: { dishId: id, version: 2 } })).requiresRetraining).toBe(true);
  });
});

describe("deleting", () => {
  it("deletes a dish with no history (cascading its links)", async () => {
    const { id } = await createDish(adminId, base());
    await deleteDish(id);
    expect(await db.dish.count()).toBe(0);
    expect(await db.dishIngredient.count()).toBe(0);
  });
  it("refuses to delete a dish with employee study history — archive instead", async () => {
    const emp = await makeUser();
    const { id } = await createDish(adminId, base());
    await publishDish(adminId, id);
    const rev = await db.dishRevision.findFirstOrThrow({ where: { dishId: id } });
    await db.dishStudyProgress.create({ data: { userId: emp.id, dishId: id, dishRevisionId: rev.id } });
    await expect(deleteDish(id)).rejects.toThrow(/Archive it instead/);
    expect(await db.dish.count()).toBe(1);
  });
});

describe("image URL validation", () => {
  it("only accepts https URLs on this project's Blob storage", async () => {
    const good = "https://abc123.public.blob.vercel-storage.com/dishes/image-xyz.png";
    expect((await createDish(adminId, { name: "A", categoryId, imageUrl: good })).id).toBeTruthy();
    for (const bad of ["http://abc.public.blob.vercel-storage.com/x.png", "https://evil.com/x.png", "https://public.blob.vercel-storage.com.evil.com/x.png", "data:image/png;base64,AAAA", "not a url"]) {
      await expect(createDish(adminId, { name: "B", categoryId, imageUrl: bad }), bad).rejects.toThrow();
    }
  });
});
