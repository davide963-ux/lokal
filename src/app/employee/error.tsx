"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ui/error-panel";

export default function EmployeeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorPanel reset={reset} digest={error.digest} homeHref="/employee" />;
}
