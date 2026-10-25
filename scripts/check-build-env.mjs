// Runs first in `npm run vercel-build`. `prisma migrate deploy` needs a database URL at BUILD time,
// and its own error ("Connection url is empty") doesn't say which variable to fix.
const blank = (v) => !v || !v.trim();
const direct = process.env.DIRECT_URL, pooled = process.env.DATABASE_URL;

if (blank(direct) && blank(pooled)) {
  const state = (name, v) => `  - ${name}: ${v === undefined ? "NOT SET" : "SET BUT EMPTY"}`;
  console.error(`
Build stopped: no database connection string is available to this build.

${state("DIRECT_URL", direct)}
${state("DATABASE_URL", pooled)}

Fix (Vercel → Project → Settings → Environment Variables):
  1. Add DATABASE_URL (pooled) and DIRECT_URL (direct) with real postgresql:// values, not blank.
     If your provider has no pooler, use the same string for both.
  2. Tick the environment you are deploying to. Production and Preview are separate checkboxes:
     a variable saved for "Production" only is invisible to a Preview build.
  3. Redeploy. Variables are read when a build starts, so existing builds don't pick up changes.

Full guide: docs/DEPLOYMENT.md (section 3).
`);
  process.exit(1);
}
if (!blank(direct) && !/^postgres(ql)?:\/\//.test(direct.trim())) {
  console.error("Build stopped: DIRECT_URL must start with postgresql://");
  process.exit(1);
}
if (blank(direct)) console.log("DIRECT_URL is empty or unset: migrations will use DATABASE_URL.");
if (blank(process.env.AUTH_SECRET)) console.warn("Warning: AUTH_SECRET is not set. The build will pass, but the app will refuse to start until it is.");
