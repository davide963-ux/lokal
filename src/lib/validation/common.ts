import { z } from "zod";

/** Trimmed optional text: "" / whitespace / undefined all become null. */
export const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

export const reqText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Must be at most ${max} characters`);

export const uuid = z.string().uuid("Invalid id");

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Image URLs must point at this project's Vercel Blob storage. This blocks javascript:/data: URLs
 * and external hosts (tracking pixels, hotlinking) and guarantees next/image can always render them.
 */
export const blobImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX);
    } catch {
      return false;
    }
  }, "Image must be uploaded through the app")
  .nullish()
  .transform((v) => (v ? v : null));
