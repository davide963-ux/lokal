import { requireEmployeePage } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { BrandMark } from "@/components/brand/logo";
import { EmployeeTabs } from "@/components/layout/employee-tabs";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireEmployeePage();
  const settings = await getSettings();
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center"><BrandMark name={settings.name} logoUrl={settings.logoUrl} size={28} /></div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
      <EmployeeTabs />
    </div>
  );
}
