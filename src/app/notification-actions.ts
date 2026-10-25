"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/authz";
import { runAction, type ActionResult } from "@/lib/action";
import { markAllRead, markRead } from "@/lib/services/notifications";
import { uuid } from "@/lib/validation/common";

// Both roles use these; the service scopes every write to the signed-in user's own rows.
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    await markRead(user.id, uuid.parse(id));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    await markAllRead(user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "All caught up" };
  });
}
