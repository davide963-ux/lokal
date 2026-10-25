import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations must use a *direct* (non-pooled) connection; the app itself uses
// the pooled DATABASE_URL through the pg driver adapter (see src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
