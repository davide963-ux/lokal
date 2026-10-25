/**
 * First-deployment admin initialisation.
 *
 *   ADMIN_NAME="Jane Doe" ADMIN_EMAIL="jane@restaurant.com" ADMIN_PASSWORD="..." npm run setup:admin
 *
 * Any value not supplied via environment variables is prompted for (password input is hidden).
 * There is intentionally no default password and no public registration page.
 */
import "dotenv/config";
import readline from "node:readline";
import { createAdminUser, ensureBaseData } from "../src/lib/setup";
import { db } from "../src/lib/db";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Suppress echo of typed characters.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function main() {
  await ensureBaseData();
  const name = process.env.ADMIN_NAME || (await ask("Admin full name: "));
  const email = process.env.ADMIN_EMAIL || (await ask("Admin email: "));
  const password = process.env.ADMIN_PASSWORD || (await ask("Admin password (min 10 chars, letters + numbers): ", true));
  const admin = await createAdminUser({ name, email, password });
  console.log(`\nAdmin created: ${admin.name} <${admin.email}>`);
  console.log("Remove ADMIN_PASSWORD from your environment now. Sign in at /login.");
}

main()
  .catch((e) => {
    console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
