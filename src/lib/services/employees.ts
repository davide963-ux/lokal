import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/password";
import { issueToken } from "@/lib/tokens";
import { normalizeEmail } from "@/lib/utils";
import { optText, reqText } from "@/lib/validation/common";
import { DomainError } from "@/lib/errors";
import type { TokenPurpose } from "@/generated/prisma/enums";

export const employeeInput = z.object({
  name: reqText("Name", 120),
  email: z.string().trim().email("Enter a valid email").max(254),
  jobTitle: optText(80),
  phone: optText(40),
});
export type EmployeeInput = z.input<typeof employeeInput>;

/** Creates an INVITED employee and a one-time setup token (raw token returned once for the admin to share). */
export async function createEmployee(raw: EmployeeInput) {
  const input = employeeInput.parse(raw);
  const email = normalizeEmail(input.email);
  if (await db.user.findUnique({ where: { email } })) throw new DomainError("A user with this email already exists.");
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email, jobTitle: input.jobTitle, phone: input.phone, role: "EMPLOYEE", status: "INVITED" },
    });
    const { raw: token, expiresAt } = await issueToken(user.id, "INVITE", tx);
    return { user, token, expiresAt };
  });
}

async function getEmployee(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  // Admin accounts are never editable through the employee screens.
  if (!user || user.role !== "EMPLOYEE") throw new DomainError("Employee not found.");
  return user;
}

export async function updateEmployee(id: string, raw: EmployeeInput) {
  const input = employeeInput.parse(raw);
  await getEmployee(id);
  const email = normalizeEmail(input.email);
  const clash = await db.user.findFirst({ where: { email, id: { not: id } } });
  if (clash) throw new DomainError("Another user already uses this email.");
  return db.user.update({
    where: { id },
    data: { name: input.name, email, jobTitle: input.jobTitle, phone: input.phone },
  });
}

export async function deactivateEmployee(id: string) {
  await getEmployee(id);
  // Bumping sessionVersion signs the person out everywhere immediately.
  await db.$transaction([
    db.user.update({ where: { id }, data: { status: "INACTIVE", sessionVersion: { increment: 1 } } }),
    db.authToken.deleteMany({ where: { userId: id, usedAt: null } }),
  ]);
}

export async function reactivateEmployee(id: string) {
  const user = await getEmployee(id);
  if (user.status !== "INACTIVE") throw new DomainError("This employee is not deactivated.");
  await db.user.update({ where: { id }, data: { status: user.passwordHash ? "ACTIVE" : "INVITED" } });
}

/** New invite link (pending accounts) or password-reset link (active accounts). */
export async function issueAccessLink(id: string) {
  const user = await getEmployee(id);
  if (user.status === "INACTIVE") throw new DomainError("Reactivate this employee first.");
  const purpose: TokenPurpose = user.status === "INVITED" ? "INVITE" : "PASSWORD_RESET";
  const { raw, expiresAt } = await issueToken(id, purpose);
  return { token: raw, expiresAt, purpose, user };
}

// ───────── Self-service profile ─────────
export const profileInput = z.object({ name: reqText("Name", 120), phone: optText(40) });

export async function updateProfile(userId: string, raw: z.input<typeof profileInput>) {
  const input = profileInput.parse(raw);
  return db.user.update({ where: { id: userId }, data: input, select: { id: true, name: true } });
}

export async function changeOwnPassword(userId: string, current: string, next: string) {
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "Invalid password");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
    throw new DomainError("Your current password is incorrect.");
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data), sessionVersion: { increment: 1 } },
  });
}
