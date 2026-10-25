import { requireAdminPage } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { AdminShell, ADMIN_NAV } from "@/components/layout/admin-nav";
import { UserBlock } from "@/components/layout/user-menu";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  const settings = await getSettings();
  return (
    <AdminShell
      brand={{ name: settings.name, logoUrl: settings.logoUrl }}
      items={ADMIN_NAV}
      footer={<UserBlock name={user.name} email={user.email} role={user.role} />}
    >
      {children}
    </AdminShell>
  );
}
