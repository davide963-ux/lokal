import { requireEmployeePage } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { BrandMark } from "@/components/brand/logo";
import { UserBlock } from "@/components/layout/user-menu";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireEmployeePage();
  const settings = await getSettings();
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <BrandMark name={settings.name} logoUrl={settings.logoUrl} size={28} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl"><UserBlock name={user.name} email={user.email} role={user.role} /></div>
      </div>
    </div>
  );
}
