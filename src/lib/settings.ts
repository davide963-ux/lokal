import { cache } from "react";
import { getOrCreateSettings } from "@/lib/services/settings";

/** The one-and-only settings row (created on first access), cached per request. */
export const getSettings = cache(getOrCreateSettings);
