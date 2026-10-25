"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Button that opens a confirmation dialog before running `onConfirm`. */
export function ConfirmButton({
  title, description, confirmLabel = "Confirm", destructive, onConfirm, children, ...buttonProps
}: Omit<ButtonProps, "onClick"> & { title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" {...buttonProps} onClick={() => setOpen(true)}>{children}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="button" variant={destructive ? "destructive" : "default"} onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
