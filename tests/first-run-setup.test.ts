import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { verifyCredentials } from "@/lib/credentials";
import { adminExists, createFirstAdmin, setupEnabled, setupTokenMatches, SetupError } from "@/lib/setup";
import { makeUser, resetDb } from "./helpers";

let ip = "9.9.9.9";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": ip }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`REDIRECT:${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
}));
vi.mock("@/auth", () => ({ auth: async () => null, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

import { setupAction } from "@/app/(auth)/actions";

const TOKEN = "t".repeat(8) + "-setup-token-" + "z".repeat(16);
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const good = { token: TOKEN, name: "Pia Neri", email: "Pia@Example.com", password: "Manager-pass-2026", confirm: "Manager-pass-2026" };
const run = (o: Record<string, string>) => setupAction(undefined, form(o)).catch((e) => ({ redirected: String(e.message) }));

beforeEach(async () => { await resetDb(); process.env.SETUP_TOKEN = TOKEN; ip = `7.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; });
afterEach(() => { delete process.env.SETUP_TOKEN; });

describe("setup token", () => {
  it("is disabled unless a long-enough token is configured", () => {
    expect(setupEnabled({})).toBe(false);
    expect(setupEnabled({ SETUP_TOKEN: "short" })).toBe(false);
    expect(setupEnabled({ SETUP_TOKEN: "   " })).toBe(false);
    expect(setupEnabled({ SETUP_TOKEN: TOKEN })).toBe(true);
    expect(setupTokenMatches("anything", {})).toBe(false);
  });
  it("matches only the exact token", () => {
    const env = { SETUP_TOKEN: TOKEN };
    expect(setupTokenMatches(TOKEN, env)).toBe(true);
    expect(setupTokenMatches(` ${TOKEN} `, env)).toBe(true); // copy/paste whitespace
    for (const bad of ["", "x", TOKEN.slice(1), TOKEN + "x", TOKEN.toUpperCase()]) expect(setupTokenMatches(bad, env), bad).toBe(false);
  });
});

describe("first-run setup action", () => {
  it("creates the first manager, signs nobody in, and the manager can log in", async () => {
    expect(await run(good)).toEqual({ redirected: "REDIRECT:/login?passwordSet=1" });
    const u = await db.user.findUniqueOrThrow({ where: { email: "pia@example.com" } });
    expect(u).toMatchObject({ role: "ADMIN", status: "ACTIVE", name: "Pia Neri" });
    expect(await db.allergen.count()).toBe(14);
    expect((await verifyCredentials({ email: "pia@example.com", password: "Manager-pass-2026" }, "1.2.3.4")).ok).toBe(true);
    expect(await adminExists()).toBe(true);
  });
  it("refuses everything when no token is configured", async () => {
    delete process.env.SETUP_TOKEN;
    expect(await run(good)).toMatchObject({ ok: false, error: "Setup is not available." });
    expect(await db.user.count()).toBe(0);
  });
  it("refuses a wrong or missing token and creates nothing", async () => {
    expect(await run({ ...good, token: "wrong-token" })).toMatchObject({ ok: false, error: "The setup token is incorrect." });
    expect(await run({ ...good, token: "" })).toMatchObject({ ok: false });
    expect(await db.user.count()).toBe(0);
  });
  it("rate-limits token guessing per IP", async () => {
    for (let i = 0; i < 6; i++) await run({ ...good, token: `guess-${i}` });
    expect(await run(good)).toMatchObject({ ok: false, error: expect.stringContaining("Too many attempts") });
    expect(await db.user.count()).toBe(0);
  });
  it("validates the details after the token is accepted", async () => {
    expect(await run({ ...good, password: "weak", confirm: "weak" })).toMatchObject({ ok: false, fieldErrors: { password: expect.any(Array) } });
    expect(await run({ ...good, confirm: "Different-pass-1" })).toMatchObject({ ok: false, fieldErrors: { confirm: ["Passwords do not match"] } });
    expect(await run({ ...good, email: "not-an-email" })).toMatchObject({ ok: false, fieldErrors: { email: expect.any(Array) } });
    expect(await db.user.count()).toBe(0);
  });
  it("is permanently closed once any administrator exists, even with the right token", async () => {
    await makeUser({ role: "ADMIN" });
    expect(await run(good)).toMatchObject({ ok: false, error: "Setup has already been completed." });
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });
  it("an employee does not count as a manager: setup can still run", async () => {
    await makeUser({ role: "EMPLOYEE" });
    expect(await run(good)).toEqual({ redirected: "REDIRECT:/login?passwordSet=1" });
  });
  it("concurrent submissions create exactly one manager", async () => {
    const results = await Promise.allSettled([
      createFirstAdmin({ name: "A", email: "a@example.com", password: "Manager-pass-2026" }),
      createFirstAdmin({ name: "B", email: "b@example.com", password: "Manager-pass-2026" }),
      createFirstAdmin({ name: "C", email: "c@example.com", password: "Manager-pass-2026" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof SetupError)).toBe(true);
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });
});
