import { execSync } from "node:child_process";

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/lokal_test";

// Applies the real migrations (including hand-written constraints) to the test database once per run.
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, DIRECT_URL: TEST_DB_URL },
  });
}
