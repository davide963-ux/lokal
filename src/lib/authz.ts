import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Source of truth for "who is calling": the JWT only identifies the user; the database decides
 * whether the account is still ACTIVE, still has the same role, and hasn't had its sessions revoked.
 * Cached per request so layouts/pages/actions don't repeat the query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const claim = session?.user;
  if (!claim?.id) return null;
  const user = await db.user.findUnique({
    where: { id: claim.id },
    select: { id: true, name: true, email: true, role: true, status: true, sessionVersion: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  if (user.sessionVersion !== claim.sessionVersion) return null; // password changed / account revoked
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** For pages & layouts: redirects when the caller is not allowed. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/employee");
  return user;
}

export async function requireEmployeePage(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/admin");
  return user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in again.");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw new ForbiddenError("Administrator access required.");
  return user;
}

export async function assertEmployee(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "EMPLOYEE") throw new ForbiddenError("Employee access required.");
  return user;
}
