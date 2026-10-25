import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkEnv } from "@/lib/env";
import { runCleanup } from "@/lib/services/maintenance";
import { GET as cron } from "@/app/api/cron/cleanup/route";
import { GET as health } from "@/app/api/health/route";
import { issueToken } from "@/lib/tokens";
import { makeCategory, makePublishedDish, makeUser, resetDb, takeQuiz } from "./helpers";

const good = { DATABASE_URL: "postgresql://u:p@h/db", AUTH_SECRET: "x".repeat(32), AUTH_URL: "https://a.example.com", BLOB_READ_WRITE_TOKEN: "t", CRON_SECRET: "c".repeat(16) };

describe("environment validation", () => {
  it("accepts a complete production configuration with no warnings", () => {
    expect(checkEnv(good, true)).toEqual({ errors: [], warnings: [] });
  });
  it("rejects a present-but-short SETUP_TOKEN so a weak token can never be configured", () => {
    expect(checkEnv({ ...good, SETUP_TOKEN: "short" }, true).errors[0]).toMatch(/SETUP_TOKEN/);
    expect(checkEnv({ ...good, SETUP_TOKEN: "s".repeat(24) }, true).errors).toEqual([]);
  });
  it("rejects missing/short/invalid critical values with actionable messages", () => {
    const r = checkEnv({ DATABASE_URL: "mysql://x", AUTH_SECRET: "short" }, true);
    expect(r.errors.join("\n")).toMatch(/DATABASE_URL must be a postgresql/);
    expect(r.errors.join("\n")).toMatch(/AUTH_SECRET must be at least 32/);
    expect(checkEnv({}, false).errors.some((e) => e.startsWith("DATABASE_URL"))).toBe(true);
    expect(checkEnv({ ...good, AUTH_URL: "not a url" }, true).errors[0]).toMatch(/AUTH_URL/);
    expect(checkEnv({ ...good, CRON_SECRET: "short" }, true).errors[0]).toMatch(/CRON_SECRET/);
  });
  it("treats blank strings as unset and warns about optional-but-important settings in production only", () => {
    const env = { ...good, AUTH_URL: " ", BLOB_READ_WRITE_TOKEN: "", CRON_SECRET: undefined };
    const prod = checkEnv(env, true);
    expect(prod.errors).toEqual([]);
    expect(prod.warnings).toHaveLength(3);
    expect(checkEnv(env, false).warnings).toEqual([]);
    expect(checkEnv({ ...good, AUTH_URL: "http://localhost:3000" }, true).warnings[0]).toMatch(/localhost/);
  });
});

describe("maintenance endpoints", () => {
  beforeEach(resetDb);
  const req = (auth?: string) => new Request("http://x/api/cron/cleanup", { headers: auth ? { authorization: auth } : {} });

  it("cleanup is closed without CRON_SECRET and with a wrong or missing bearer token", async () => {
    delete process.env.CRON_SECRET;
    expect((await cron(req("Bearer anything-long-enough-123"))).status).toBe(401);
    process.env.CRON_SECRET = "a-long-enough-secret";
    expect((await cron(req())).status).toBe(401);
    expect((await cron(req("Bearer wrong-secret-of-equal-ln"))).status).toBe(401);
    expect((await cron(req("a-long-enough-secret"))).status).toBe(401); // missing "Bearer "
    const ok = await cron(req("Bearer a-long-enough-secret"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
    delete process.env.CRON_SECRET;
  });
  it("prunes only expired housekeeping rows and never training history", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const cat = await makeCategory();
    const { dishId } = await makePublishedDish(admin.id, cat.id, "Carbonara");
    const emp = await makeUser();
    await takeQuiz(emp.id, dishId);
    const old = new Date(Date.now() - 400 * 86400000);
    await db.rateLimit.createMany({ data: [{ key: "old", count: 1, windowStart: old }, { key: "fresh", count: 1 }] });
    const { raw } = await issueToken(emp.id, "PASSWORD_RESET");
    await db.authToken.create({ data: { userId: emp.id, purpose: "INVITE", tokenHash: "dead", expiresAt: old } });
    await db.notification.createMany({ data: [
      { userId: emp.id, type: "DISH_UPDATED", title: "old read", message: "m", isRead: true, createdAt: old },
      { userId: emp.id, type: "DISH_UPDATED", title: "old unread", message: "m", isRead: false, createdAt: old },
    ] });
    const attemptsBefore = await db.quizAttempt.count(), studiesBefore = await db.dishStudyProgress.count(), revsBefore = await db.dishRevision.count();

    const r = await runCleanup();
    expect(r).toMatchObject({ rateLimits: 1, tokens: 1, notifications: 1, staleAttempts: 0 });
    expect((await db.rateLimit.findMany()).map((x) => x.key)).toContain("fresh");
    expect(await db.authToken.count({ where: { tokenHash: "dead" } })).toBe(0);
    expect(await db.authToken.count()).toBe(1); // the live reset token survives
    expect((await db.notification.findMany({ where: { title: { startsWith: "old" } } })).map((n) => n.title)).toEqual(["old unread"]);
    expect([await db.quizAttempt.count(), await db.dishStudyProgress.count(), await db.dishRevision.count()]).toEqual([attemptsBefore, studiesBefore, revsBefore]);
    expect(raw).toBeTruthy();
  });
  it("removes in-progress attempts abandoned for a month, keeps recent ones", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const cat = await makeCategory();
    const { dishId } = await makePublishedDish(admin.id, cat.id, "Penne");
    const emp = await makeUser();
    const { acknowledgeStudy } = await import("@/lib/services/training");
    const { startAttempt } = await import("@/lib/services/attempts");
    await acknowledgeStudy(emp.id, dishId);
    const { attemptId } = await startAttempt(emp.id, dishId);
    expect((await runCleanup()).staleAttempts).toBe(0);
    await db.quizAttempt.update({ where: { id: attemptId }, data: { startedAt: new Date(Date.now() - 40 * 86400000) } });
    expect((await runCleanup()).staleAttempts).toBe(1);
  });
  it("health endpoint reports ok when the database answers, without leaking details", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
