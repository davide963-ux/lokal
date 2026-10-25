import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createAdminUser, ensureBaseData, resetAdminPassword, STANDARD_ALLERGENS } from "@/lib/setup";
import { verifyCredentials } from "@/lib/credentials";
import { makeUser } from "./helpers";
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

describe("admin password recovery", () => {
  it("sets a new password, reactivates, and signs out every existing session", async () => {
    const a = await createAdminUser({ name: "J", email: "j@r.com", password: "Old-password-12" });
    await db.user.update({ where: { id: a.id }, data: { status: "INACTIVE" } });
    const before = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    await resetAdminPassword("J@R.com", "Brand-new-pass-77");
    const after = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(after).toMatchObject({ status: "ACTIVE", sessionVersion: before.sessionVersion + 1 });
    expect((await verifyCredentials({ email: "j@r.com", password: "Brand-new-pass-77" }, "5.5.5.5")).ok).toBe(true);
    expect((await verifyCredentials({ email: "j@r.com", password: "Old-password-12" }, "5.5.5.5")).ok).toBe(false);
  });
  it("refuses employees, unknown emails and weak passwords", async () => {
    await makeUser({ email: "emp@r.com" });
    await createAdminUser({ name: "J", email: "j@r.com", password: "Old-password-12" });
    await expect(resetAdminPassword("emp@r.com", "Brand-new-pass-77")).rejects.toThrow(/No administrator/);
    await expect(resetAdminPassword("nobody@r.com", "Brand-new-pass-77")).rejects.toThrow(/No administrator/);
    await expect(resetAdminPassword("j@r.com", "weak")).rejects.toThrow();
  });
});
