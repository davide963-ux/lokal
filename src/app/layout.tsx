import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s?.name ?? "Staff Training";
  return {
    title: { default: `${name} · Staff Training`, template: `%s · ${name}` },
    description: `Menu and service training for the ${name} team.`,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6f54",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings().catch(() => null);
  return (
    <html lang={s?.preferredLanguage ?? "en"}>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
