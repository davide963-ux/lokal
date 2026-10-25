import { z } from "zod";
import { blobImageUrl, optText, reqText, uuid } from "./common";

export const dishIngredientInput = z.object({
  name: reqText("Ingredient name", 80),
  quantity: optText(60),
  isOptional: z.boolean().default(false),
  isRemovable: z.boolean().default(false),
  substitutionNotes: optText(300),
});

export const dishInput = z.object({
  name: reqText("Dish name", 120),
  categoryId: uuid,
  shortDescription: optText(200),
  description: optText(4000),
  price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(100000)
    .nullish()
    .transform((v) => (v == null ? null : Math.round(v * 100) / 100)),
  isAvailable: z.boolean().default(true),
  imageUrl: blobImageUrl,

  ingredients: z.array(dishIngredientInput).max(60, "Too many ingredients").default([]),

  allergens: z
    .array(z.object({ allergenId: uuid, presence: z.enum(["CONTAINS", "MAY_CONTAIN"]) }))
    .max(40)
    .default([]),
  dietaryTags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  crossContactWarnings: optText(1000),
  allergenNotes: optText(1000),
  /** Manager attestation that the allergen & dietary information above is correct. */
  allergensVerified: z.boolean().default(false),

  cookingMethod: optText(200),
  preparationInstructions: optText(5000),
  prepTimeMinutes: z.number().int().min(0).max(24 * 60).nullish().transform((v) => v ?? null),
  servingTemperature: optText(100),
  garnishes: optText(500),
  presentationDetails: optText(1000),

  waiterDescription: optText(2000),
  recommendedPairings: optText(1000),
  guestInformation: optText(2000),
  managerNotes: optText(2000),

  // Revision controls (only meaningful when the dish is published)
  changeSummary: optText(300),
  requiresRetraining: z.boolean().default(false),
});

export type DishInput = z.infer<typeof dishInput>;
export type DishFormInput = z.input<typeof dishInput>;
