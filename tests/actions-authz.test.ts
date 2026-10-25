import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeCategory, makeUser, resetDb } from "./helpers";

let mockSession: { user: { id: string; role: string; sessionVersion: number } } | null = null;
vi.mock("@/auth", () => ({
  auth: async () => mockSession,
  signOut: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import * as menu from "@/app/admin/menu/actions";
import * as ingredients from "@/app/admin/ingredients/actions";
import * as employees from "@/app/admin/employees/actions";
import * as settings from "@/app/admin/settings/actions";
import * as uploads from "@/app/admin/upload-actions";
import * as account from "@/app/admin/account/actions";
import * as quizzes from "@/app/admin/quizzes/actions";
import * as learning from "@/app/employee/actions";

const ID = "00000000-0000-4000-8000-000000000000";
const ADMIN_ONLY = { ...menu, ...ingredients, ...employees, ...settings, ...uploads, ...quizzes };
const EMPLOYEE_ONLY = { ...learning };

async function snapshotCounts() {
  return JSON.stringify({
    users: await db.user.count(), dishes: await db.dish.count(), categories: await db.category.count(),
    ingredients: await db.ingredient.count(), allergens: await db.allergen.count(), tokens: await db.authToken.count(),
    settings: await db.restaurantSettings.findMany(),
  });
}

// Generous junk arguments: the permission check must fire before any argument is even looked at.
const junkArgs = [ID, { name: "x", email: "x@example.com", categoryId: ID }, "up"] as const;

beforeEach(async () => {
  await resetDb();
  mockSession = null;
});

describe("every admin server action enforces the ADMIN role on the server", () => {
  const names = Object.keys(ADMIN_ONLY);

  it("covers a meaningful number of actions", () => {
    expect(names.length).toBeGreaterThanOrEqual(31);
  });

  it("anonymous callers are refused and nothing is written", async () => {
    await makeCategory();
    const before = await snapshotCounts();
    for (const [name, fn] of Object.entries(ADMIN_ONLY)) {
      const res = await (fn as (...a: unknown[]) => Promise<{ ok: boolean; error?: string }>)(...junkArgs);
      expect(res, name).toMatchObject({ ok: false, error: "Please sign in again." });
    }
    expect(await snapshotCounts()).toBe(before);
  });

  it("employees are refused and nothing is written", async () => {
    const emp = await makeUser({ role: "EMPLOYEE" });
    mockSession = { user: { id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion } };
    const before = await snapshotCounts();
    for (const [name, fn] of Object.entries(ADMIN_ONLY)) {
      const res = await (fn as (...a: unknown[]) => Promise<{ ok: boolean; error?: string }>)(...junkArgs);
      expect(res, name).toMatchObject({ ok: false, error: "Administrator access required." });
    }
    expect(await snapshotCounts()).toBe(before);
  });

  it("an employee who forges an ADMIN role claim in their token is still refused", async () => {
    const emp = await makeUser({ role: "EMPLOYEE" });
    mockSession = { user: { id: emp.id, role: "ADMIN", sessionVersion: emp.sessionVersion } };
    const res = await menu.createCategoryAction({ name: "Hacked" });
    expect(res).toMatchObject({ ok: false, error: "Administrator access required." });
    expect(await db.category.count()).toBe(0);
  });

  it("a deactivated admin is refused immediately", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    mockSession = { user: { id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion } };
    expect((await menu.createCategoryAction({ name: "Ok" })).ok).toBe(true);
    await db.user.update({ where: { id: admin.id }, data: { status: "INACTIVE" } });
    expect(await menu.createCategoryAction({ name: "Nope" })).toMatchObject({ ok: false });
    expect(await db.category.count()).toBe(1);
  });
});

describe("every employee learning action enforces the EMPLOYEE role on the server", () => {
  const call = (fn: unknown) => (fn as (...a: unknown[]) => Promise<{ ok: boolean; error?: string }>)(ID, {});
  it("anonymous callers are refused", async () => {
    for (const [name, fn] of Object.entries(EMPLOYEE_ONLY)) expect(await call(fn), name).toMatchObject({ ok: false, error: "Please sign in again." });
  });
  it("administrators cannot study dishes or take quizzes (no progress can be created under an admin id)", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    mockSession = { user: { id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion } };
    for (const [name, fn] of Object.entries(EMPLOYEE_ONLY)) expect(await call(fn), name).toMatchObject({ ok: false, error: "Employee access required." });
    expect(await db.dishStudyProgress.count()).toBe(0);
    expect(await db.quizAttempt.count()).toBe(0);
  });
  it("employees cannot reach the quiz builder actions", async () => {
    const emp = await makeUser();
    mockSession = { user: { id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion } };
    expect(await quizzes.publishQuizAction(ID)).toMatchObject({ ok: false, error: "Administrator access required." });
  });
});

describe("self-service account actions", () => {
  it("require sign-in", async () => {
    expect(await account.updateProfileAction({ name: "x" })).toMatchObject({ ok: false, error: "Please sign in again." });
    expect(await account.changePasswordAction("a", "b")).toMatchObject({ ok: false, error: "Please sign in again." });
  });
  it("only ever modify the caller's own record", async () => {
    const me = await makeUser({ name: "Me" });
    const other = await makeUser({ name: "Other" });
    mockSession = { user: { id: me.id, role: "EMPLOYEE", sessionVersion: me.sessionVersion } };
    expect((await account.updateProfileAction({ name: "Me Renamed", phone: "123" })).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).name).toBe("Me Renamed");
    expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).name).toBe("Other");
  });
});

describe("admin actions return validation errors, not crashes", () => {
  it("surfaces domain errors as friendly results", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    mockSession = { user: { id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion } };
    await menu.createCategoryAction({ name: "Pasta" });
    expect(await menu.createCategoryAction({ name: "pasta" })).toEqual({ ok: false, error: '"pasta" already exists.' });
    const res = await menu.createCategoryAction({ name: "   " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.name?.[0]).toMatch(/required/);
  });
  it("employee creation returns an absolute one-time invite link", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    mockSession = { user: { id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion } };
    process.env.AUTH_URL = "https://trattoria.example.com/";
    const res = await employees.createEmployeeAction({ name: "Lucia", email: "lucia@example.com" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.link.url).toMatch(/^https:\/\/trattoria\.example\.com\/set-password\/[\w-]{40,}$/);
  });
});
