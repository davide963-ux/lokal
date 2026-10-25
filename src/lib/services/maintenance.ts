import { db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Housekeeping, safe to run any number of times. Never touches training history:
 * attempts that were submitted, study records and revisions are kept forever.
 */
export async function runCleanup(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const [rateLimits, tokens, notifications, staleAttempts] = await Promise.all([
    db.rateLimit.deleteMany({ where: { windowStart: { lt: ago(1) } } }),
    db.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(30) } }, { usedAt: { lt: ago(30) } }] } }),
    db.notification.deleteMany({ where: { isRead: true, createdAt: { lt: ago(180) } } }),
    // Never-submitted attempts abandoned for a month (they hold no result).
    db.quizAttempt.deleteMany({ where: { status: "IN_PROGRESS", startedAt: { lt: ago(30) } } }),
  ]);
  return { rateLimits: rateLimits.count, tokens: tokens.count, notifications: notifications.count, staleAttempts: staleAttempts.count };
}
