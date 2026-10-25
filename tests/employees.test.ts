import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  changeOwnPassword, createEmployee, deactivateEmployee, issueAccessLink,
  reactivateEmployee, updateEmployee, updateProfile,
} from "@/lib/services/employees";
import { findValidToken } from "@/lib/tokens";
import { setPasswordWithToken } from "@/lib/account";
import { verifyCredentials } from "@/lib/credentials";
import { makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("employee management", () => {
  it("creates an INVITED EMPLOYEE (never an admin) with a usable one-time invite", async () => {
    const { user, token } = await createEmployee({ name: "Maria Verdi", email: "Maria@Example.com", jobTitle: "Waiter" });
    expect(user).toMatchObject({ role: "EMPLOYEE", status: "INVITED", email: "maria@example.com", passwordHash: null });
    expect((await findValidToken(token))?.purpose).toBe("INVITE");
    expect(await setPasswordWithToken(token, "Maria-secure-77")).toEqual({ ok: true });
    expect((await verifyCredentials({ email: "maria@example.com", password: "Maria-secure-77" }, "9.9.9.9")).ok).toBe(true);
  });
  it("rejects duplicate emails (any case) and invalid input", async () => {
    await createEmployee({ name: "A", email: "a@example.com" });
    await expect(createEmployee({ name: "B", email: "A@EXAMPLE.COM" })).rejects.toThrow(/already exists/);
    await expect(createEmployee({ name: "", email: "x@example.com" })).rejects.toThrow();
    await expect(createEmployee({ name: "C", email: "not-an-email" })).rejects.toThrow();
  });
  it("deactivation blocks login, revokes sessions and pending links; reactivation restores", async () => {
    const emp = await makeUser({ email: "e@example.com", password: "Correct-horse1" });
    const { token } = await issueAccessLink(emp.id);
    await deactivateEmployee(emp.id);
    const after = await db.user.findUniqueOrThrow({ where: { id: emp.id } });
    expect(after.status).toBe("INACTIVE");
    expect(after.sessionVersion).toBe(emp.sessionVersion + 1);
    expect(await findValidToken(token)).toBeNull();
    expect((await verifyCredentials({ email: "e@example.com", password: "Correct-horse1" }, "8.8.8.8")).ok).toBe(false);
    await expect(issueAccessLink(emp.id)).rejects.toThrow(/Reactivate/);
    await reactivateEmployee(emp.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: emp.id } })).status).toBe("ACTIVE");
  });
  it("a deactivated invited user returns to INVITED, not ACTIVE-without-password", async () => {
    const { user } = await createEmployee({ name: "P", email: "p@example.com" });
    await deactivateEmployee(user.id);
    await reactivateEmployee(user.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("INVITED");
  });
  it("issues INVITE links for pending users and PASSWORD_RESET links for active ones", async () => {
    const { user } = await createEmployee({ name: "P", email: "p@example.com" });
    expect((await issueAccessLink(user.id)).purpose).toBe("INVITE");
    const active = await makeUser();
    expect((await issueAccessLink(active.id)).purpose).toBe("PASSWORD_RESET");
  });
  it("employee screens can never modify an admin account", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await expect(updateEmployee(admin.id, { name: "Hax", email: "hax@example.com" })).rejects.toThrow(/not found/);
    await expect(deactivateEmployee(admin.id)).rejects.toThrow(/not found/);
    await expect(issueAccessLink(admin.id)).rejects.toThrow(/not found/);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("ACTIVE");
  });
  it("update refuses an email that belongs to someone else", async () => {
    await makeUser({ email: "taken@example.com" });
    const other = await makeUser({ email: "free@example.com" });
    await expect(updateEmployee(other.id, { name: "X", email: "TAKEN@example.com" })).rejects.toThrow(/already uses/);
  });
});

describe("own profile", () => {
  it("updates name/phone", async () => {
    const u = await makeUser();
    await updateProfile(u.id, { name: "New Name", phone: " 555 " });
    expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ name: "New Name", phone: "555" });
  });
  it("changing password needs the current one, enforces policy, and revokes other sessions", async () => {
    const u = await makeUser({ email: "c@example.com", password: "Old-password-1" });
    await expect(changeOwnPassword(u.id, "wrong", "New-password-22")).rejects.toThrow(/current password/);
    await expect(changeOwnPassword(u.id, "Old-password-1", "weak")).rejects.toThrow();
    await changeOwnPassword(u.id, "Old-password-1", "New-password-22");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).sessionVersion).toBe(u.sessionVersion + 1);
    expect((await verifyCredentials({ email: "c@example.com", password: "New-password-22" }, "7.7.7.7")).ok).toBe(true);
  });
});
