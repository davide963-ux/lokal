import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";

export function UserBlock({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials(name)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{role === "ADMIN" ? "Manager" : email}</p>
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" className="size-9"><LogOut /></Button>
      </form>
    </div>
  );
}
