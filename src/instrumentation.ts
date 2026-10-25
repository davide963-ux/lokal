// Runs once when the server starts. A misconfigured deployment fails loudly here
// (with an actionable message in the logs) instead of failing obscurely on the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkEnv } = await import("@/lib/env");
  const production = process.env.NODE_ENV === "production";
  const { errors, warnings } = checkEnv(process.env, production);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) {
    const msg = `Invalid environment configuration:\n - ${errors.join("\n - ")}`;
    if (production) throw new Error(msg);
    console.error(`[config] ${msg}`);
  }
}
