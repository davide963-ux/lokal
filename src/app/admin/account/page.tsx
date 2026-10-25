import { PageHeader } from "@/components/layout/page-header";
import { AccountForms } from "@/components/account/account-forms";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";

export const metadata = { title: "My account" };

export default async function AdminAccountPage() {
  const me = await requireAdminPage();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { name: true, email: true, phone: true } });
  return (
    <>
      <PageHeader title="My account" />
      <AccountForms name={user.name} email={user.email} phone={user.phone ?? ""} />
    </>
  );
}
