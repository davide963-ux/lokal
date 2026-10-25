"use client";

import { AlertTriangle, Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Friendly full-width error / not-found block. Never prints the raw error: only an opaque reference. */
export function ErrorPanel({ variant = "error", reset, digest, homeHref = "/" }: { variant?: "error" | "notfound"; reset?: () => void; digest?: string; homeHref?: string }) {
  const notFound = variant === "notfound";
  const Icon = notFound ? Compass : AlertTriangle;
  return (
    <div role={notFound ? undefined : "alert"} className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className={`mb-4 flex size-14 items-center justify-center rounded-full ${notFound ? "bg-primary-soft text-primary" : "bg-warning-soft text-warning"}`}><Icon className="size-7" /></div>
      <h1 className="text-2xl font-semibold">{notFound ? "We couldn't find that page" : "Something went wrong"}</h1>
      <p className="mt-2 text-muted-foreground">
        {notFound ? "The page may have moved, or the dish or quiz may no longer be available." : "That didn't work, and it's not your fault. Please try again. If it keeps happening, tell your manager."}
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {reset && <Button onClick={reset}>Try again</Button>}
        <Button asChild variant="secondary"><Link href={homeHref}>{notFound ? "Go home" : "Back to home"}</Link></Button>
      </div>
    </div>
  );
}
