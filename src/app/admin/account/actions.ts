"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import { assertUser } from "@/lib/authz";
import { fail, runAction, type ActionResult } from "@/lib/action";
import { changeOwnPassword, profileInput, updateProfile } from "@/lib/services/employees";
import { rateLimit } from "@/lib/rate-limit";

/** Shared by the admin and employee account pages: both only ever touch the caller's own row. */
export async function updateProfileAction(input: z.input<typeof profileInput>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    await updateProfile(user.id, input);
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile updated" };
  });
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  const result = await runAction<undefined>(async () => {
    const user = await assertUser();
    const limited = await rateLimit(`chpw:${user.id}`, 8, 15 * 60);
    if (!limited.ok) return fail("Too many attempts. Please wait a few minutes.");
    await changeOwnPassword(user.id, z.string().max(200).parse(current), next);
    return { ok: true };
  });
  // All sessions (including this one) were revoked by the password change; send them to sign in again.
  if (result.ok) await signOut({ redirectTo: "/login?passwordSet=1" });
  return result;
}
