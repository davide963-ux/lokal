"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ui/error-panel";

// Lives inside the admin layout, so the sidebar stays usable.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorPanel reset={reset} digest={error.digest} homeHref="/admin" />;
}
