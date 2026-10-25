import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations must use a *direct* (non-pooled) connection; the app itself uses
// the pooled DATABASE_URL through the pg driver adapter (see src/lib/db.ts).
// `||` (not `??`) on purpose: a variable that exists but is blank (easy to create in the
// Vercel form) must fall through to the next one instead of becoming an empty URL.
const nonBlank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: nonBlank(process.env.DIRECT_URL) ?? nonBlank(process.env.DATABASE_URL) ?? "",
  },
});
