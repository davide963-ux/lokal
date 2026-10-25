import Link from "next/link";
import { Bell } from "lucide-react";
import { requireEmployeePage } from "@/lib/authz";
import { unreadCount } from "@/lib/services/notifications";
import { getSettings } from "@/lib/settings";
import { BrandMark } from "@/components/brand/logo";
import { EmployeeTabs } from "@/components/layout/employee-tabs";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireEmployeePage();
  const [settings, unread] = await Promise.all([getSettings(), unreadCount(user.id)]);
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <BrandMark name={settings.name} logoUrl={settings.logoUrl} size={28} />
          <Link href="/employee/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative -mr-2 rounded-full p-2 text-muted-foreground">
            <Bell className="size-6" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
      <EmployeeTabs />
    </div>
  );
}
