import { createHash, randomBytes } from "node:crypto";
import { db, type Tx } from "@/lib/db";
import type { TokenPurpose } from "@/generated/prisma/enums";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 24 * 60 * 60 * 1000,
};

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Creates a single-use token and returns the RAW value (shown to the admin once).
 * Only its SHA-256 is persisted. Any earlier unused token of the same purpose is revoked.
 */
export async function issueToken(userId: string, purpose: TokenPurpose, client: Tx | typeof db = db) {
  const raw = randomBytes(32).toString("base64url");
  await client.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);
  await client.authToken.create({ data: { userId, purpose, tokenHash: hashToken(raw), expiresAt } });
  return { raw, expiresAt };
}

/** Looks up a usable token (exists, unused, unexpired). Does not consume it. */
export async function findValidToken(raw: string) {
  if (!raw || raw.length > 200) return null;
  const token = await db.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!token || token.usedAt || token.expiresAt <= new Date()) return null;
  if (token.user.status === "INACTIVE") return null;
  return token;
}
