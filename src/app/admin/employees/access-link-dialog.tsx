"use client";

import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AccessLink } from "./actions";

export function AccessLinkDialog({ link, onClose }: { link: AccessLink | null; onClose: () => void }) {
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {link && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><LinkIcon className="size-5 text-primary" />{link.purpose === "INVITE" ? "Invitation link" : "Password reset link"}</DialogTitle>
              <DialogDescription>
                Send this link to {link.name} (for example by WhatsApp or SMS). They use it to {link.purpose === "INVITE" ? "choose a password and activate their account" : "choose a new password"}.
              </DialogDescription>
            </DialogHeader>
            <CopyField value={link.url} />
            <p className="text-xs text-muted-foreground">
              Single-use and expires {new Date(link.expiresAt).toLocaleString()}. It is shown only now. If you lose it, generate a new one from the employee&apos;s page.
            </p>
            <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
