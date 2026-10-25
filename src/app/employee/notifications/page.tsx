import { NotificationList } from "@/components/notifications/notification-list";
import { requireEmployeePage } from "@/lib/authz";
import { listNotifications } from "@/lib/services/notifications";

export const metadata = { title: "Notifications" };

export default async function EmployeeNotificationsPage() {
  const user = await requireEmployeePage();
  const items = await listNotifications(user.id);
  return (
    <>
      <h1 className="mb-5 text-3xl font-semibold">Notifications</h1>
      <NotificationList items={items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
    </>
  );
}
