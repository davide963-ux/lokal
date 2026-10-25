"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { setPasswordWithToken } from "@/lib/account";
import { fail, type ActionResult } from "@/lib/action";
import { passwordSchema } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createFirstAdmin, SetupError, setupEnabled, setupTokenMatches } from "@/lib/setup";

/** Only allow same-site relative redirects after login (blocks open-redirect via ?callbackUrl=). */
function safeRedirectTarget(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  return "/";
}

export async function loginAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as { code?: string }).code;
      if (code === "rate_limited") return fail("Too many attempts. Please wait a few minutes and try again.");
      return fail("Incorrect email or password.");
    }
    throw err;
  }
  redirect(safeRedirectTarget(formData.get("callbackUrl")));
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const setPasswordSchema = z
  .object({ token: z.string().min(10).max(200), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function setPasswordAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const limited = await rateLimit(`setpw:${clientIp(await headers())}`, 10, 15 * 60);
  if (!limited.ok) return fail("Too many attempts. Please wait a few minutes and try again.");

  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[String(i.path[0] ?? "_")] ??= []).push(i.message);
    return fail("Please fix the highlighted fields.", fieldErrors);
  }
  const result = await setPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!result.ok) return fail(result.error);
  redirect("/login?passwordSet=1");
}

const firstAdminSchema = z
  .object({ name: z.string().trim().min(1, "Name is required").max(120), email: z.string().trim().email("Enter a valid email").max(254), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

/** One-time first-run setup (see lib/setup.ts). Token-gated, rate-limited, dead once an admin exists. */
export async function setupAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const limited = await rateLimit(`setup:${clientIp(await headers())}`, 6, 15 * 60);
  if (!limited.ok) return fail("Too many attempts. Please wait a few minutes and try again.");
  if (!setupEnabled()) return fail("Setup is not available.");
  if (!setupTokenMatches(String(formData.get("token") ?? ""))) return fail("The setup token is incorrect.");

  const parsed = firstAdminSchema.safeParse({
    name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[String(i.path[0] ?? "_")] ??= []).push(i.message);
    return fail("Please fix the highlighted fields.", fieldErrors);
  }
  try {
    await createFirstAdmin({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password });
  } catch (e) {
    if (e instanceof SetupError) return fail(e.message);
    throw e;
  }
  redirect("/login?passwordSet=1");
}
