import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { MAX_IMAGE_BYTES, sniffImageType, validateImageUpload } from "@/lib/uploads";
import { settingsInput, updateSettings } from "@/lib/services/settings";
import { resetDb } from "./helpers";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const WEBP = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")];
const file = (bytes: number[] | Uint8Array, name = "x.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });

describe("image upload validation", () => {
  it("recognises JPEG, PNG and WebP by content", () => {
    expect(sniffImageType(new Uint8Array(PNG))?.ext).toBe("png");
    expect(sniffImageType(new Uint8Array(JPG))?.ext).toBe("jpg");
    expect(sniffImageType(new Uint8Array(WEBP))?.ext).toBe("webp");
  });
  it("rejects SVG, HTML, executables and empty files even when labelled image/png", async () => {
    for (const body of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<html></html>", "MZ\x90\x00"]) {
      const res = await validateImageUpload(file(Buffer.from(body), "evil.png", "image/png"));
      expect(res.ok).toBe(false);
    }
    expect((await validateImageUpload(file([], "empty.png"))).ok).toBe(false);
    expect((await validateImageUpload("not a file")).ok).toBe(false);
  });
  it("trusts content over claimed type and enforces the size cap", async () => {
    const ok = await validateImageUpload(file(PNG, "photo.jpg", "image/jpeg"));
    expect(ok.ok && ok.type.contentType).toBe("image/png");
    const big = await validateImageUpload(file(new Uint8Array(MAX_IMAGE_BYTES + 1).fill(0xff).map((v, i) => (i < 3 ? [0xff, 0xd8, 0xff][i]! : v))));
    expect(big).toEqual({ ok: false, error: "Image is too large (max 4 MB)." });
  });
});

describe("restaurant settings", () => {
  beforeEach(resetDb);
  it("upserts the single settings record and never creates a second", async () => {
    await updateSettings({ name: "Trattoria Rossi", preferredLanguage: "it", contactEmail: "info@rossi.it", description: "  Family run  " });
    await updateSettings({ name: "Trattoria Rossi 2", preferredLanguage: "en" });
    const rows = await db.restaurantSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Trattoria Rossi 2", description: null, contactEmail: null });
  });
  it("validates name, email, language and logo URL scheme", () => {
    expect(settingsInput.safeParse({ name: "" }).success).toBe(false);
    expect(settingsInput.safeParse({ name: "X", contactEmail: "nope" }).success).toBe(false);
    expect(settingsInput.safeParse({ name: "X", preferredLanguage: "xx" }).success).toBe(false);
    expect(settingsInput.safeParse({ name: "X", logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsInput.safeParse({ name: "X", logoUrl: "https://a.public.blob.vercel-storage.com/l.png" }).success).toBe(true);
  });
});
