"use server";

import { assertAdmin } from "@/lib/authz";
import { fail, runAction, type ActionResult } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/uploads";

export async function uploadImageAction(folder: "dishes" | "branding", formData: FormData): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    if (folder !== "dishes" && folder !== "branding") return fail("Invalid upload target.");
    const limited = await rateLimit(`upload:${admin.id}`, 40, 10 * 60);
    if (!limited.ok) return fail("Too many uploads. Please wait a moment.");
    const res = await uploadImage(formData.get("file"), folder);
    if (!res.ok) return fail(res.error);
    return { ok: true, data: { url: res.url } };
  });
}
