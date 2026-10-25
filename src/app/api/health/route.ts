import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability for uptime monitors. Reveals nothing about the system. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
