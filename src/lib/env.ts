import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a postgresql:// connection string"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (generate: openssl rand -base64 32)"),
  AUTH_URL: z.string().url("AUTH_URL must be a full URL such as https://your-app.vercel.app").optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
  SETUP_TOKEN: z.string().min(24, "SETUP_TOKEN must be at least 24 characters (or remove it)").optional(),
});

export type EnvReport = { errors: string[]; warnings: string[] };

/** Pure: checks a given environment object. Errors stop the app from starting; warnings are logged. */
export function checkEnv(env: Record<string, string | undefined>, production: boolean): EnvReport {
  const blank = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
  const parsed = schema.safeParse({
    DATABASE_URL: blank(env.DATABASE_URL) ?? "",
    AUTH_SECRET: blank(env.AUTH_SECRET) ?? "",
    AUTH_URL: blank(env.AUTH_URL),
    BLOB_READ_WRITE_TOKEN: blank(env.BLOB_READ_WRITE_TOKEN),
    CRON_SECRET: blank(env.CRON_SECRET),
    SETUP_TOKEN: blank(env.SETUP_TOKEN),
  });
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
  const warnings: string[] = [];
  if (production) {
    if (!blank(env.AUTH_URL)) warnings.push("AUTH_URL is not set: invite and reset links will be built from request headers. Set it to your public URL.");
    else if (/localhost|127\.0\.0\.1/.test(env.AUTH_URL!)) warnings.push("AUTH_URL points at localhost in production.");
    if (!blank(env.BLOB_READ_WRITE_TOKEN)) warnings.push("BLOB_READ_WRITE_TOKEN is not set: photo and logo uploads are disabled.");
    if (!blank(env.CRON_SECRET)) warnings.push("CRON_SECRET is not set: the daily cleanup job will be rejected.");
    if (blank(env.DATABASE_URL) && /localhost|127\.0\.0\.1/.test(env.DATABASE_URL!)) warnings.push("DATABASE_URL points at localhost in production.");
  }
  return { errors, warnings };
}
