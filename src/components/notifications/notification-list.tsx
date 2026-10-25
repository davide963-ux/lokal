"use client";

import { Bell, BookOpen, CheckCheck, RefreshCw, Rocket, ShieldAlert, Trophy, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";

export type NotificationItem = { id: string; type: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string };

const ICON: Record<string, typeof Bell> = {
  DISH_PUBLISHED: BookOpen, DISH_UPDATED: RefreshCw, QUIZ_AVAILABLE: Rocket, RETRAINING_REQUIRED: ShieldAlert,
  QUIZ_FAILED: XCircle, TRAINING_COMPLETED: Trophy, RETRAINING_PENDING: ShieldAlert,
};

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Only same-site paths are followed (links are server-generated, but never trust a stored string blindly). */
const safe = (l: string | null) => (l && l.startsWith("/") && !l.startsWith("//") ? l : null);

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const unread = items.filter((i) => !i.isRead).length;
  if (items.length === 0) return <EmptyState icon={Bell} title="No notifications yet" description="Updates about dishes, quizzes and training will appear here." />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 && <Button variant="ghost" size="sm" loading={pending} onClick={() => run(() => markAllNotificationsReadAction(), { success: false })}><CheckCheck />Mark all read</Button>}
      </div>
      <Card><ul className="divide-y divide-border">
        {items.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          const link = safe(n.link);
          return (
            <li key={n.id}>
              <button type="button" className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60", !n.isRead && "bg-primary-soft/40")}
                onClick={() => {
                  if (n.isRead) return link ? router.push(link) : undefined;
                  run(() => markNotificationReadAction(n.id), { success: false, refresh: !link, onSuccess: () => link && router.push(link) });
                }}>
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", n.isRead ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary")}><Icon className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block", !n.isRead && "font-semibold")}>{n.title}</span>
                  <span className="block text-sm text-muted-foreground">{n.message}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                </span>
                {!n.isRead && <span aria-label="Unread" className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" />}
              </button>
            </li>
          );
        })}
      </ul></Card>
    </div>
  );
}
