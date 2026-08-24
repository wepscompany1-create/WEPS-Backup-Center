"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteBackupDialog({
  backup,
  onOpenChange,
  onDeleted,
}: {
  backup: { id: string; backupNumber: number; createdAt: string } | null;
  onOpenChange: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState("");

  async function onDelete() {
    if (!backup) return;
    const response = await fetch(`/api/backups/${backup.id}`, { method: "DELETE" });
    if (!response.ok) {
      const json = await response.json();
      toast.error(json.message || "تعذر حذف النسخة");
      return;
    }
    setConfirm("");
    onOpenChange();
    onDeleted();
  }

  return (
    <Dialog
      open={Boolean(backup)}
      onOpenChange={() => {
        setConfirm("");
        onOpenChange();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف النسخة الاحتياطية؟</DialogTitle>
          <DialogDescription>
            سيتم حذف الملف المشفر رقم {backup?.backupNumber}. اكتب «حذف» للتأكيد.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">تأكيد</Label>
          <Input id="confirm-delete" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={onOpenChange}>
            إلغاء
          </Button>
          <Button variant="destructive" className="cursor-pointer" disabled={confirm !== "حذف"} onClick={() => void onDelete()}>
            حذف نهائي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
