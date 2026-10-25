import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/notifications/notification-list";
import { requireAdminPage } from "@/lib/authz";
import { listNotifications } from "@/lib/services/notifications";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const user = await requireAdminPage();
  const items = await listNotifications(user.id);
  return (
    <>
      <PageHeader title="Notifications" description="Failed quizzes, completed training and updates that need your team's attention." />
      <div className="max-w-2xl"><NotificationList items={items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} /></div>
    </>
  );
}
