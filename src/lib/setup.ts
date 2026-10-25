import { db } from "@/lib/db";
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
  await db.restaurantSettings.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });
  // Sequential on purpose: each upsert is idempotent, so no transaction is needed, and awaiting one
  // query at a time avoids pipelining queries on a single pg client (deprecated in pg 9).
  for (const [i, name] of STANDARD_ALLERGENS.entries()) {
    await db.allergen.upsert({ where: { name }, update: {}, create: { name, sortOrder: i } });
  }
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
