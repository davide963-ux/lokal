import { db } from "@/lib/db";

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window counter stored in PostgreSQL, so it works across serverless instances.
 * The upsert is a single atomic statement; concurrent requests cannot under-count.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; elapsed: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${windowSec}::double precision) THEN 1
        ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${windowSec}::double precision) THEN now()
        ELSE "RateLimit"."windowStart" END
    RETURNING "count", EXTRACT(EPOCH FROM (now() - "windowStart"))::float8 AS "elapsed"`;
  const row = rows[0];
  if (!row) return { ok: true, remaining: limit };
  if (row.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(windowSec - row.elapsed)) };
  }
  return { ok: true, remaining: limit - row.count };
}

export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Best-effort client IP behind Vercel / proxies. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
