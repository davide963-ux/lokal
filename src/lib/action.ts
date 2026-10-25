import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/authz";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function fail(error: string, fieldErrors?: FieldErrors): { ok: false; error: string; fieldErrors?: FieldErrors } {
  return { ok: false, error, fieldErrors };
}

export function zodFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Wraps a server action body so authorization and validation failures become typed results
 * instead of unhandled exceptions. Unknown errors are logged and returned generically.
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return fail(err.message);
    if (err instanceof ZodError) return fail("Please fix the highlighted fields.", zodFieldErrors(err));
    // Next.js control-flow errors (redirect/notFound) must propagate.
    if (err instanceof Error && "digest" in err && typeof (err as { digest?: unknown }).digest === "string") throw err;
    console.error("Unhandled action error:", err);
    return fail("Something went wrong. Please try again.");
  }
}
