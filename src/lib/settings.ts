import { cache } from "react";
import { db } from "@/lib/db";

/** The one-and-only settings row. Created on first access so a fresh database never 500s. */
export const getSettings = cache(async () => {
  return db.restaurantSettings.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });
});
