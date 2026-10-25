import "dotenv/config";
import { ensureBaseData } from "../src/lib/setup";
import { db } from "../src/lib/db";

// Safe to run on every deploy: creates only the settings row and standard allergen vocabulary.
// No demo users, no demo dishes, no default passwords.
ensureBaseData()
  .then(() => console.log("Base data ready."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
