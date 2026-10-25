import { BrandMark } from "@/components/brand/logo";
import { getSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <BrandMark name={s.name} logoUrl={s.logoUrl} size={44} className="mb-8 justify-center" />
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground">Staff training portal</p>
      </div>
    </main>
  );
}
