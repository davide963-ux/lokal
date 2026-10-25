"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ui/error-panel";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="min-h-dvh"><ErrorPanel reset={reset} digest={error.digest} /></main>;
}
