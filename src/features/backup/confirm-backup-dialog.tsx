"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmBackupDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إنشاء نسخة احتياطية الآن؟</DialogTitle>
          <DialogDescription>
            سيتم أخذ نسخة كاملة مشفرة من قاعدة البيانات الأساسية. العملية لا تعدّل بيانات الإنتاج.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            className="cursor-pointer"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
