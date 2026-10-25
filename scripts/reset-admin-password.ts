/**
 * Recover a manager account (there is no email flow for managers):
 *   ADMIN_EMAIL="jane@restaurant.com" ADMIN_PASSWORD="..." npm run admin:reset-password
 * Unset values are prompted for (password input hidden). Signs the manager out everywhere.
 */
import "dotenv/config";
import readline from "node:readline";
import { resetAdminPassword } from "../src/lib/setup";
import { db } from "../src/lib/db";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}

(async () => {
  const email = process.env.ADMIN_EMAIL || (await ask("Administrator email: "));
  const password = process.env.ADMIN_PASSWORD || (await ask("New password (min 10 chars, letters + numbers): ", true));
  const r = await resetAdminPassword(email, password);
  console.log(`\nPassword reset for ${r.email}. All existing sessions were signed out.`);
})()
  .catch((e) => { console.error(`\nFailed: ${e instanceof Error ? e.message : e}`); process.exitCode = 1; })
  .finally(() => db.$disconnect());
