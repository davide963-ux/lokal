import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGES } from "@/lib/languages";
import { blobImageUrl, optText, reqText } from "@/lib/validation/common";

export const settingsInput = z.object({
  name: reqText("Restaurant name", 80),
  description: optText(1000),
  address: optText(300),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(254)]).nullish().transform((v) => v || null),
  contactPhone: optText(40),
  preferredLanguage: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]).default("en"),
  logoUrl: blobImageUrl,
});

/**
 * Returns the single settings row, creating it if missing. Safe under concurrency: Prisma's upsert is
 * not atomic, so parallel first requests (or parallel build workers) on an empty database would collide
 * on the unique `singleton` column. INSERT ... ON CONFLICT DO NOTHING (skipDuplicates) cannot.
 */
export async function getOrCreateSettings() {
  // findFirst, not findUnique: Prisma batches concurrent findUnique calls into an `in` filter, which is invalid for a Boolean column.
  const existing = await db.restaurantSettings.findFirst({ where: { singleton: true } });
  if (existing) return existing;
  await db.restaurantSettings.createMany({ data: [{ singleton: true }], skipDuplicates: true });
  return db.restaurantSettings.findFirstOrThrow({ where: { singleton: true } });
}

export async function updateSettings(raw: z.input<typeof settingsInput>) {
  const input = settingsInput.parse(raw);
  await getOrCreateSettings();
  return db.restaurantSettings.update({ where: { singleton: true }, data: input });
}
