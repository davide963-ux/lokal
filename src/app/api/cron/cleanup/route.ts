import { timingSafeEqual } from "node:crypto";
import { runCleanup } from "@/lib/services/maintenance";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // not configured → endpoint is closed
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET` (see vercel.json).
export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const result = await runCleanup();
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
