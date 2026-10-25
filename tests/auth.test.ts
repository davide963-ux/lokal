import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { verifyCredentials } from "@/lib/credentials";
import { passwordSchema, hashPassword, verifyPassword } from "@/lib/password";
import { issueToken, findValidToken, hashToken } from "@/lib/tokens";
import { setPasswordWithToken } from "@/lib/account";
import { makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("password policy", () => {
  it("rejects short, letter-only, number-only and >72 byte passwords", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletterslong").success).toBe(false);
    expect(passwordSchema.safeParse("1234567890123").success).toBe(false);
    expect(passwordSchema.safeParse("a1".repeat(40)).success).toBe(false);
    expect(passwordSchema.safeParse("goodpassword123").success).toBe(true);
  });
  it("hashes with bcrypt and verifies", async () => {
    const hash = await hashPassword("goodpassword123");
    expect(hash).not.toContain("goodpassword123");
    expect(await verifyPassword("goodpassword123", hash)).toBe(true);
    expect(await verifyPassword("wrongpassword123", hash)).toBe(false);
  });
});

describe("verifyCredentials", () => {
  it("accepts valid credentials, case-insensitive email, and records lastLoginAt", async () => {
    const u = await makeUser({ email: "maria@example.com", password: "Correct-horse1" });
    const res = await verifyCredentials({ email: "  MARIA@Example.com ", password: "Correct-horse1" }, "1.1.1.1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.user.id).toBe(u.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).lastLoginAt).not.toBeNull();
  });
  it("rejects wrong password, unknown email, malformed input", async () => {
    await makeUser({ email: "a@example.com", password: "Correct-horse1" });
    for (const input of [
      { email: "a@example.com", password: "nope" },
      { email: "ghost@example.com", password: "Correct-horse1" },
      { email: "not-an-email", password: "x" },
      {},
    ]) {
      expect(await verifyCredentials(input, "2.2.2.2")).toEqual({ ok: false, reason: "invalid" });
    }
  });
  it("rejects INACTIVE and INVITED accounts even with the right password", async () => {
    await makeUser({ email: "off@example.com", status: "INACTIVE", password: "Correct-horse1" });
    await makeUser({ email: "inv@example.com", status: "INVITED" });
    expect((await verifyCredentials({ email: "off@example.com", password: "Correct-horse1" }, "3.3.3.3")).ok).toBe(false);
    expect((await verifyCredentials({ email: "inv@example.com", password: "anything-1234" }, "3.3.3.3")).ok).toBe(false);
  });
  it("rate-limits repeated attempts per account, even with the right password afterwards", async () => {
    await makeUser({ email: "brute@example.com", password: "Correct-horse1" });
    for (let i = 0; i < 8; i++) {
      await verifyCredentials({ email: "brute@example.com", password: "wrong-pass-1" }, `10.0.0.${i}`);
    }
    const res = await verifyCredentials({ email: "brute@example.com", password: "Correct-horse1" }, "10.0.1.1");
    expect(res).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("auth tokens (invite / reset)", () => {
  it("stores only a hash, never the raw token", async () => {
    const u = await makeUser({ status: "INVITED" });
    const { raw } = await issueToken(u.id, "INVITE");
    const row = await db.authToken.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.tokenHash).toBe(hashToken(raw));
    expect(JSON.stringify(row)).not.toContain(raw);
  });
  it("issuing a new token revokes the previous unused one", async () => {
    const u = await makeUser({ status: "INVITED" });
    const first = await issueToken(u.id, "INVITE");
    const second = await issueToken(u.id, "INVITE");
    expect(await findValidToken(first.raw)).toBeNull();
    expect(await findValidToken(second.raw)).not.toBeNull();
  });
  it("expired tokens are invalid", async () => {
    const u = await makeUser({ status: "INVITED" });
    const { raw } = await issueToken(u.id, "INVITE");
    await db.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findValidToken(raw)).toBeNull();
  });
  it("setPasswordWithToken activates an invited user, is single-use, and revokes old sessions", async () => {
    const u = await makeUser({ status: "INVITED" });
    const { raw } = await issueToken(u.id, "INVITE");
    expect(await setPasswordWithToken(raw, "weak")).toMatchObject({ ok: false });
    expect(await setPasswordWithToken(raw, "Brand-new-pass1")).toEqual({ ok: true });
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.sessionVersion).toBe(u.sessionVersion + 1);
    expect(await verifyPassword("Brand-new-pass1", after.passwordHash!)).toBe(true);
    expect(await setPasswordWithToken(raw, "Another-pass22")).toMatchObject({ ok: false });
  });
  it("two concurrent submissions of one token: exactly one wins", async () => {
    const u = await makeUser({ status: "INVITED" });
    const { raw } = await issueToken(u.id, "INVITE");
    const results = await Promise.all([
      setPasswordWithToken(raw, "Concurrent-pass1"),
      setPasswordWithToken(raw, "Concurrent-pass2"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
  it("deactivated users cannot use a reset token", async () => {
    const u = await makeUser({ status: "INACTIVE" });
    const { raw } = await issueToken(u.id, "PASSWORD_RESET");
    expect(await findValidToken(raw)).toBeNull();
  });
});
