"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/**
 * Runs a server action inside a transition: exposes `pending`, toasts the outcome,
 * refreshes server data on success, and hands the result back for custom handling.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string | false; refresh?: boolean; onSuccess?: (r: Extract<ActionResult<T>, { ok: true }>) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void } = {}) => {
      startTransition(async () => {
        let result: ActionResult<T>;
        try {
          result = await fn();
        } catch {
          toast.error("Network problem. Please try again.");
          return;
        }
        if (result.ok) {
          if (opts.success !== false) toast.success(opts.success ?? result.message ?? "Saved");
          opts.onSuccess?.(result);
          if (opts.refresh !== false) router.refresh();
        } else {
          toast.error(result.error);
          opts.onError?.(result);
        }
      });
    },
    [router],
  );

  return { run, pending };
}
