"use client";

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

export function RestoreTestDialog({
  backup,
  onOpenChange,
  onStarted,
}: {
  backup: { id: string; backupNumber: number } | null;
  onOpenChange: () => void;
  onStarted: () => void;
}) {
  async function start() {
    if (!backup) return;
    const response = await fetch("/api/restore-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupId: backup.id }),
    });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.message || "تعذر بدء اختبار الاستعادة");
      return;
    }
    onOpenChange();
    onStarted();
  }

  return (
    <Dialog open={Boolean(backup)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>اختبار الاستعادة</DialogTitle>
          <DialogDescription>
            سيتم إنشاء قاعدة PostgreSQL مؤقتة باسم بادئة restore_test_ ثم استعادة النسخة رقم {backup?.backupNumber} إليها
            وإجراء فحوصات عامة ثم حذف القاعدة تلقائياً. هذه العملية ليست استعادة للإنتاج.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={onOpenChange}>
            إلغاء
          </Button>
          <Button className="cursor-pointer" onClick={() => void start()}>
            بدء الاختبار
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
