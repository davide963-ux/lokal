import { z } from "zod";
import { db } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sessionVersion: number;
};

export type CredentialsResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: "invalid" | "rate_limited" };

const MAX_ATTEMPTS_PER_ACCOUNT = 8; // per email, per 15 minutes
const MAX_ATTEMPTS_PER_IP = 30; // per IP, per 15 minutes
const WINDOW_SEC = 15 * 60;

/**
 * The single place passwords are checked. Used by the Auth.js credentials provider
 * (so direct POSTs to /api/auth/callback/credentials are protected as well).
 */
export async function verifyCredentials(raw: unknown, ip: string): Promise<CredentialsResult> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const email = normalizeEmail(parsed.data.email);

  const [byIp, byAccount] = await Promise.all([
    rateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_SEC),
    rateLimit(`login:acct:${email}`, MAX_ATTEMPTS_PER_ACCOUNT, WINDOW_SEC),
  ]);
  if (!byIp.ok || !byAccount.ok) return { ok: false, reason: "rate_limited" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.status !== "ACTIVE") {
    await burnPasswordCheck(parsed.data.password); // constant-ish timing
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { ok: false, reason: "invalid" };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion },
  };
}
