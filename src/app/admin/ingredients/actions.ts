"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { runAction, type ActionResult } from "@/lib/action";
import {
  createAllergen, createIngredient, deleteAllergen, deleteIngredient, renameAllergen, updateIngredient,
} from "@/lib/services/catalog";
import { uuid } from "@/lib/validation/common";

const refresh = () => {
  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/menu", "layout");
};
type In = { name: string; description?: string | null };

export async function createIngredientAction(input: In): Promise<ActionResult> {
  return runAction(async () => { await assertAdmin(); await createIngredient(input); refresh(); return { ok: true, message: "Ingredient added" }; });
}
export async function updateIngredientAction(id: string, input: In): Promise<ActionResult> {
  return runAction(async () => { await assertAdmin(); await updateIngredient(uuid.parse(id), input); refresh(); return { ok: true, message: "Ingredient updated" }; });
}
export async function deleteIngredientAction(id: string): Promise<ActionResult> {
  return runAction(async () => { await assertAdmin(); await deleteIngredient(uuid.parse(id)); refresh(); return { ok: true, message: "Ingredient deleted" }; });
}
export async function createAllergenAction(input: { name: string }): Promise<ActionResult> {
  return runAction(async () => { await assertAdmin(); await createAllergen(input); refresh(); return { ok: true, message: "Allergen added" }; });
}
export async function renameAllergenAction(id: string, input: { name: string }): Promise<ActionResult> {
  return runAction(async () => { await assertAdmin(); await renameAllergen(uuid.parse(id), input); refresh(); return { ok: true, message: "Allergen renamed" }; });
}
export async function deleteAllergenAction(id: string): Promise<ActionResult> {
  return runAction(async () => { await assertAdmin(); await deleteAllergen(uuid.parse(id)); refresh(); return { ok: true, message: "Allergen deleted" }; });
}
