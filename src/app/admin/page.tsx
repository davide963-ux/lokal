import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireAdminPage();
  const [dishes, employees] = await Promise.all([
    db.dish.count({ where: { status: "PUBLISHED" } }),
    db.user.count({ where: { role: "EMPLOYEE", status: "ACTIVE" } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Good to see you, {user.name.split(" ")[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Menu dishes</CardTitle></CardHeader><CardContent><p className="text-4xl font-semibold">{dishes}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Active employees</CardTitle></CardHeader><CardContent><p className="text-4xl font-semibold">{employees}</p></CardContent></Card>
      </div>
    </div>
  );
}
