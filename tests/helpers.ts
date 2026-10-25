import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Role, UserStatus } from "@/generated/prisma/enums";

/** Empties every table (keeps schema + constraints). Call in beforeEach. */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export async function makeUser(
  opts: { role?: Role; status?: UserStatus; email?: string; password?: string; name?: string } = {},
) {
  counter += 1;
  return db.user.create({
    data: {
      name: opts.name ?? `User ${counter}`,
      email: opts.email ?? `user${counter}@example.com`,
      role: opts.role ?? "EMPLOYEE",
      status: opts.status ?? "ACTIVE",
      passwordHash: opts.status === "INVITED" ? null : await hashPassword(opts.password ?? "Passw0rd-test!"),
    },
  });
}
