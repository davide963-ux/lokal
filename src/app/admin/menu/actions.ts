"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { runAction, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import {
  archiveDish, createDish, deleteDish, publishDish, restoreDish,
  setLatestRevisionRetraining, unpublishDish, updateDish,
} from "@/lib/services/dishes";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "@/lib/services/catalog";
import { deleteImage } from "@/lib/uploads";
import { uuid } from "@/lib/validation/common";
import type { DishFormInput } from "@/lib/validation/dish";

const refresh = (id?: string) => {
  revalidatePath("/admin/menu");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/menu/${id}`);
};

export async function saveDishAction(
  id: string | null,
  input: DishFormInput,
): Promise<ActionResult<{ id: string; version: number | null; retraining: boolean }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    if (id) {
      uuid.parse(id);
      const before = await db.dish.findUnique({ where: { id }, select: { imageUrl: true } });
      const res = await updateDish(admin.id, id, input);
      if (before?.imageUrl && before.imageUrl !== input.imageUrl) await deleteImage(before.imageUrl);
      refresh(id);
      return {
        ok: true,
        data: { id, version: res.revision?.version ?? null, retraining: res.revision?.requiresRetraining ?? false },
        message: res.revision ? `Saved as version ${res.revision.version}` : "Dish saved",
      };
    }
    const { id: newId } = await createDish(admin.id, input);
    refresh();
    return { ok: true, data: { id: newId, version: null, retraining: false }, message: "Dish created as draft" };
  });
}

export async function publishDishAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertAdmin();
    await publishDish(admin.id, uuid.parse(id));
    refresh(id);
    return { ok: true, message: "Dish published" };
  });
}
export async function unpublishDishAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await unpublishDish(uuid.parse(id));
    refresh(id);
    return { ok: true, message: "Dish moved back to draft" };
  });
}
export async function archiveDishAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await archiveDish(uuid.parse(id));
    refresh(id);
    return { ok: true, message: "Dish archived" };
  });
}
export async function restoreDishAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await restoreDish(uuid.parse(id));
    refresh(id);
    return { ok: true, message: "Dish restored as draft" };
  });
}
export async function deleteDishAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    const dish = await db.dish.findUnique({ where: { id: uuid.parse(id) }, select: { imageUrl: true } });
    await deleteDish(id);
    await deleteImage(dish?.imageUrl);
    refresh();
    return { ok: true, message: "Dish deleted" };
  });
}
export async function setRetrainingAction(id: string, value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await setLatestRevisionRetraining(uuid.parse(id), value);
    refresh(id);
    return { ok: true, message: value ? "Employees will be asked to review this update" : "Retraining requirement removed" };
  });
}

// ───────── Categories ─────────
export async function createCategoryAction(input: { name: string; description?: string | null }): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await createCategory(input);
    revalidatePath("/admin/menu", "layout");
    return { ok: true, message: "Category added" };
  });
}
export async function updateCategoryAction(id: string, input: { name: string; description?: string | null }): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await updateCategory(uuid.parse(id), input);
    revalidatePath("/admin/menu", "layout");
    return { ok: true, message: "Category updated" };
  });
}
export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await deleteCategory(uuid.parse(id));
    revalidatePath("/admin/menu", "layout");
    return { ok: true, message: "Category deleted" };
  });
}
export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await moveCategory(uuid.parse(id), direction === "up" ? "up" : "down");
    revalidatePath("/admin/menu", "layout");
    return { ok: true };
  });
}
