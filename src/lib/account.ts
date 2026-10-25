import { db } from "@/lib/db";
import { hashPassword, passwordSchema } from "@/lib/password";
import { findValidToken } from "@/lib/tokens";

export type SetPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Consumes an invite / reset token and sets the password atomically.
 * - Single use: the token row is claimed with a conditional update inside the transaction,
 *   so two concurrent submissions cannot both succeed.
 * - Bumps sessionVersion so every previously issued session is invalidated.
 */
export async function setPasswordWithToken(rawToken: string, password: string): Promise<SetPasswordResult> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password" };

  const token = await findValidToken(rawToken);
  if (!token) return { ok: false, error: "This link is invalid or has expired. Ask your manager for a new one." };

  const passwordHash = await hashPassword(parsed.data);
  return db.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      return { ok: false as const, error: "This link has already been used." };
    }
    await tx.user.update({
      where: { id: token.userId },
      data: {
        passwordHash,
        status: token.user.status === "INVITED" ? "ACTIVE" : token.user.status,
        sessionVersion: { increment: 1 },
      },
    });
    await tx.authToken.deleteMany({ where: { userId: token.userId, id: { not: token.id } } });
    return { ok: true as const };
  });
}
