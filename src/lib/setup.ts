import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/services/settings";
import { hashPassword, passwordSchema } from "@/lib/password";
import { normalizeEmail } from "@/lib/utils";
import { z } from "zod";

// The 14 allergens that EU food-information rules require businesses to declare.
// This is only the *vocabulary* managers pick from; which allergens a dish contains is always
// entered and verified by a manager, never inferred by the application.
export const STANDARD_ALLERGENS = [
  "Celery",
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Lupin",
  "Milk",
  "Molluscs",
  "Mustard",
  "Tree nuts",
  "Peanuts",
  "Sesame",
  "Soybeans",
  "Sulphur dioxide / sulphites",
] as const;

/** Idempotent: creates the settings singleton and the standard allergen list if missing. */
export async function ensureBaseData() {
  await getOrCreateSettings();
  // Sequential + ON CONFLICT DO NOTHING: idempotent and safe if two setups run at once.
  await db.allergen.createMany({ data: STANDARD_ALLERGENS.map((name, i) => ({ name, sortOrder: i })), skipDuplicates: true });
}

const adminInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: passwordSchema,
});

export async function createAdminUser(input: { name: string; email: string; password: string }) {
  const data = adminInput.parse(input);
  const email = normalizeEmail(data.email);
  if (await db.user.findUnique({ where: { email } })) {
    throw new Error(`A user with email ${email} already exists.`);
  }
  return db.user.create({
    data: {
      name: data.name,
      email,
      passwordHash: await hashPassword(data.password),
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: { id: true, email: true, name: true },
  });
}

/**
 * Operator recovery path (no email flow exists for managers): sets a new password for an existing
 * ADMIN and signs them out everywhere. Only reachable with database access, via scripts/reset-admin-password.ts.
 */
export async function resetAdminPassword(emailRaw: string, password: string) {
  const email = normalizeEmail(z.string().trim().email().parse(emailRaw));
  const parsed = passwordSchema.parse(password);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") throw new Error(`No administrator with email ${email}.`);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed), status: "ACTIVE", sessionVersion: { increment: 1 } },
  });
  await db.authToken.deleteMany({ where: { userId: user.id } });
  return { id: user.id, email };
}

// ───────── Browser-based first-run setup ─────────
// For owners who cannot run `npm run setup:admin`. Gated by SETUP_TOKEN (a random secret set in the
// deployment's environment, so only whoever controls the deployment can use it) and permanently
// disabled the moment any administrator exists.

export class SetupError extends Error {}

const MIN_TOKEN_LENGTH = 24;

export function setupEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SETUP_TOKEN?.trim().length ?? 0) >= MIN_TOKEN_LENGTH;
}

export function setupTokenMatches(given: string, env: Record<string, string | undefined> = process.env): boolean {
  if (!setupEnabled(env)) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(given.trim()), h(env.SETUP_TOKEN!.trim()));
}

export async function adminExists(): Promise<boolean> {
  return (await db.user.count({ where: { role: "ADMIN" } })) > 0;
}

/**
 * Creates the very first administrator. An advisory lock serialises concurrent attempts, so two
 * simultaneous submissions can never both succeed.
 */
export async function createFirstAdmin(input: { name: string; email: string; password: string }) {
  const data = adminInput.parse(input);
  const email = normalizeEmail(data.email);
  const passwordHash = await hashPassword(data.password); // slow by design: do it before taking the lock
  const admin = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(727001)`;
    if ((await tx.user.count({ where: { role: "ADMIN" } })) > 0) throw new SetupError("Setup has already been completed.");
    if (await tx.user.findUnique({ where: { email } })) throw new SetupError("A user with this email already exists.");
    return tx.user.create({
      data: { name: data.name, email, passwordHash, role: "ADMIN", status: "ACTIVE" },
      select: { id: true, email: true, name: true },
    });
  });
  await ensureBaseData();
  return admin;
}
