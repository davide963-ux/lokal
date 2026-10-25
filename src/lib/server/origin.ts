import { headers } from "next/headers";

/** Absolute URL for links shown to admins (invite / reset). Prefers the configured AUTH_URL. */
export async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/$/, "");
  if (configured) return `${configured}${path}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
