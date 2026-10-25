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

export async function updateSettings(raw: z.input<typeof settingsInput>) {
  const input = settingsInput.parse(raw);
  return db.restaurantSettings.upsert({
    where: { singleton: true },
    update: input,
    create: { singleton: true, ...input },
  });
}
