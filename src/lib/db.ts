import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One PrismaClient per server instance. In dev, hot reloads would otherwise leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Serverless functions each hold their own pool; keep it small and rely on the
  // provider's pooler (PgBouncer / Neon pooler) for fan-in.
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
// Transaction client handed to `db.$transaction(async (tx) => ...)`.
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
