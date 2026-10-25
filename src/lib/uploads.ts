import { put, del } from "@vercel/blob";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type ImageType = { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/**
 * Identifies the real image format from the file's leading bytes. The browser-supplied
 * MIME type and filename are never trusted. SVG is deliberately unsupported (script injection).
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return { contentType: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

export type UploadValidation = { ok: true; type: ImageType; bytes: Uint8Array } | { ok: false; error: string };

export async function validateImageUpload(file: unknown): Promise<UploadValidation> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Please choose an image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image is too large (max 4 MB)." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "Unsupported image. Use a JPEG, PNG or WebP file." };
  return { ok: true, type, bytes };
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadImage(file: unknown, folder: "dishes" | "branding"): Promise<UploadResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: "Image storage is not configured (BLOB_READ_WRITE_TOKEN is missing)." };
  }
  const v = await validateImageUpload(file);
  if (!v.ok) return v;
  const blob = await put(`${folder}/image.${v.type.ext}`, Buffer.from(v.bytes), {
    access: "public",
    contentType: v.type.contentType,
    addRandomSuffix: true,
  });
  return { ok: true, url: blob.url };
}

/** Best-effort cleanup of a replaced image; failures must never break the user's save. */
export async function deleteImage(url: string | null | undefined) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN || !url.includes(".blob.vercel-storage.com")) return;
  try {
    await del(url);
  } catch (err) {
    console.warn("Blob delete failed:", err);
  }
}
