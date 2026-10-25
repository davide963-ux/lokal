import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createAdminUser, ensureBaseData, STANDARD_ALLERGENS } from "@/lib/setup";
import { verifyPassword } from "@/lib/password";
import { resetDb } from "./helpers";

beforeEach(resetDb);

describe("initial admin setup", () => {
  it("creates an ADMIN with a hashed password and normalised email", async () => {
    const a = await createAdminUser({ name: "Jane", email: "Jane@Rest.COM", password: "Strong-pass-123" });
    const row = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(row).toMatchObject({ role: "ADMIN", status: "ACTIVE", email: "jane@rest.com" });
    expect(row.passwordHash).not.toContain("Strong-pass-123");
    expect(await verifyPassword("Strong-pass-123", row.passwordHash!)).toBe(true);
  });
  it("refuses weak passwords and duplicate emails", async () => {
    await expect(createAdminUser({ name: "J", email: "j@r.com", password: "admin" })).rejects.toThrow();
    await createAdminUser({ name: "J", email: "j@r.com", password: "Strong-pass-123" });
    await expect(createAdminUser({ name: "J2", email: "J@r.com", password: "Strong-pass-123" })).rejects.toThrow(/exists/);
  });
  it("ensureBaseData is idempotent and seeds the settings singleton + allergens", async () => {
    await ensureBaseData();
    await ensureBaseData();
    expect(await db.restaurantSettings.count()).toBe(1);
    expect(await db.allergen.count()).toBe(STANDARD_ALLERGENS.length);
  });
  it("the database refuses a second RestaurantSettings row", async () => {
    await ensureBaseData();
    await expect(db.restaurantSettings.create({ data: { singleton: false } })).rejects.toThrow();
    await expect(db.restaurantSettings.create({ data: { singleton: true } })).rejects.toThrow();
  });
});
