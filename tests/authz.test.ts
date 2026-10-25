import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, resetDb } from "./helpers";
import { db } from "@/lib/db";

// Auth.js is replaced by a controllable session; the DB check in authz.ts is the real code under test.
let mockSession: { user: { id: string; role: string; sessionVersion: number } } | null = null;
vi.mock("@/auth", () => ({ auth: async () => mockSession }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`REDIRECT:${to}`), { digest: `NEXT_REDIRECT;${to}` });
  },
}));

import {
  assertAdmin,
  assertEmployee,
  assertUser,
  ForbiddenError,
  getCurrentUser,
  requireAdminPage,
  requireEmployeePage,
} from "@/lib/authz";

const asUser = (u: { id: string; role: string; sessionVersion: number }) => (mockSession = { user: u });

beforeEach(async () => {
  await resetDb();
  mockSession = null;
});

describe("authorization", () => {
  it("anonymous callers are rejected everywhere", async () => {
    expect(await getCurrentUser()).toBeNull();
    await expect(assertUser()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertAdmin()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("admin passes admin checks, fails employee checks", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    asUser({ id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion });
    await expect(assertAdmin()).resolves.toMatchObject({ id: admin.id });
    await expect(assertEmployee()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireEmployeePage()).rejects.toThrow("REDIRECT:/admin");
  });

  it("employee is blocked from admin operations (server-side)", async () => {
    const emp = await makeUser({ role: "EMPLOYEE" });
    asUser({ id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion });
    await expect(assertAdmin()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/employee");
    await expect(assertEmployee()).resolves.toMatchObject({ id: emp.id });
  });

  it("a forged JWT role claim does not grant privileges: the DB role wins", async () => {
    const emp = await makeUser({ role: "EMPLOYEE" });
    asUser({ id: emp.id, role: "ADMIN", sessionVersion: emp.sessionVersion }); // tampered claim
    await expect(assertAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deactivating a user kills their existing session immediately", async () => {
    const emp = await makeUser();
    asUser({ id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion });
    expect(await getCurrentUser()).not.toBeNull();
    await db.user.update({ where: { id: emp.id }, data: { status: "INACTIVE" } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("bumping sessionVersion (password change) invalidates old sessions", async () => {
    const emp = await makeUser();
    asUser({ id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion });
    await db.user.update({ where: { id: emp.id }, data: { sessionVersion: { increment: 1 } } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("a deleted user's session is rejected", async () => {
    const emp = await makeUser();
    asUser({ id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion });
    await db.user.delete({ where: { id: emp.id } });
    expect(await getCurrentUser()).toBeNull();
  });
});
