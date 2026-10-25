import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { AccountForms } from "@/components/account/account-forms";
import { Button } from "@/components/ui/button";
import { requireEmployeePage } from "@/lib/authz";
import { db } from "@/lib/db";

export const metadata = { title: "My account" };

export default async function EmployeeAccountPage() {
  const me = await requireEmployeePage();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { name: true, email: true, phone: true } });
  return (
    <>
      <h1 className="mb-5 text-3xl font-semibold">My account</h1>
      <AccountForms name={user.name} email={user.email} phone={user.phone ?? ""} />
      <form action={logoutAction} className="mt-6 max-w-xl"><Button type="submit" variant="secondary" size="lg" className="h-12 w-full"><LogOut />Sign out</Button></form>
    </>
  );
}
