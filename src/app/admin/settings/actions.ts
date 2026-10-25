"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { runAction, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { settingsInput, updateSettings } from "@/lib/services/settings";
import { deleteImage } from "@/lib/uploads";
import type { z } from "zod";

export async function updateSettingsAction(input: z.input<typeof settingsInput>): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    const before = await db.restaurantSettings.findFirst({ where: { singleton: true }, select: { logoUrl: true } });
    const saved = await updateSettings(input);
    if (before?.logoUrl && before.logoUrl !== saved.logoUrl) await deleteImage(before.logoUrl);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved" };
  });
}
