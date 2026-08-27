"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { formatBytes, formatDateTimeAr } from "@/lib/format";

type BackupTarget = {
  id: string;
  backupNumber: number;
  createdAt: string;
  encryptedSizeBytes: string | null;
  integrityStatus: string;
};

export function ProductionRestoreDialog({
  backup,
  onOpenChange,
  onStarted,
}: {
  backup: BackupTarget | null;
  onOpenChange: () => void;
  onStarted: (jobId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"RESTORE_ONLY" | "RESTORE_AND_CUTOVER">("RESTORE_ONLY");
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [backupNumber, setBackupNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!backup) return;
    setStep(1);
    setMode("RESTORE_ONLY");
    setAcknowledged(false);
    setPhrase("");
    setBackupNumber("");
    setPassword("");
  }, [backup]);

  const confirmed =
    acknowledged &&
    phrase === "استعادة-الإنتاج" &&
    backupNumber === String(backup?.backupNumber) &&
    password.length > 0;

  async function start() {
    if (!backup || submitting || !confirmed) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/production-restores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupId: backup.id,
          confirmationPhrase: phrase,
          backupNumber: Number(backupNumber),
          acknowledgeOverwrite: acknowledged,
          mode,
          currentPassword: password,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.message || "تعذر بدء استعادة الإنتاج");
        return;
      }
      onOpenChange();
      onStarted(json.jobId);
    } catch {
      toast.error("تعذر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(backup)} onOpenChange={(open) => !open && onOpenChange()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>استعادة الإنتاج — الخطوة {step} من 5</DialogTitle>
          <DialogDescription>
            تُنشأ قاعدة مرشحة منفصلة أولاً. لا يحدث التبديل في هذه العملية.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && backup ? (
          <div className="space-y-3 text-sm">
            <p>رقم النسخة: <strong>{backup.backupNumber}</strong></p>
            <p>التاريخ: {formatDateTimeAr(backup.createdAt)}</p>
            <p>الحجم: {backup.encryptedSizeBytes ? formatBytes(Number(backup.encryptedSizeBytes)) : "—"}</p>
            <div className="flex items-center gap-2">السلامة: <StatusBadge value={backup.integrityStatus} /></div>
            <p className="text-muted-foreground">يتحقق الخادم من وجود اختبار استعادة ناجح لنفس النسخة.</p>
          </div>
        ) : null}

        {step === 2 ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">اختيار الوضع</legend>
            <ModeOption
              checked={mode === "RESTORE_ONLY"}
              onChange={() => setMode("RESTORE_ONLY")}
              title="استعادة إلى قاعدة مرشحة فقط"
              description="الخيار الآمن الافتراضي. تبقى خطوة التبديل مستقلة."
            />
            <ModeOption
              checked={mode === "RESTORE_AND_CUTOVER"}
              onChange={() => setMode("RESTORE_AND_CUTOVER")}
              title="التحضير للتبديل"
              description="لا ينفذ التبديل تلقائياً؛ يلزم تأكيد ثانٍ وكلمة المرور."
            />
          </fieldset>
        ) : null}

        {step === 3 ? (
          <Alert variant="destructive">
            <AlertTitle>تحذير خطير</AlertTitle>
            <AlertDescription>
              ستُنشأ نسخة مرشحة من بيانات سابقة. لن تُستبدل بيانات الإنتاج الآن، لكن
              التبديل اللاحق يتطلب إيقاف التطبيق المصدر ويستبدل البيانات الحالية.
            </AlertDescription>
          </Alert>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
              />
              <span>أفهم أن التبديل اللاحق سيستبدل قاعدة الإنتاج الحالية وأنه لا يتم تلقائياً.</span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="production-phrase">اكتب استعادة-الإنتاج</Label>
              <Input id="production-phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production-backup-number">رقم النسخة</Label>
              <Input id="production-backup-number" inputMode="numeric" dir="ltr" value={backupNumber} onChange={(event) => setBackupNumber(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production-password">كلمة المرور الحالية</Label>
              <Input id="production-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3 text-sm">
            <p>النسخة: <strong>{backup?.backupNumber}</strong></p>
            <p>الوضع: {mode === "RESTORE_ONLY" ? "قاعدة مرشحة فقط" : "التحضير للتبديل"}</p>
            <Alert>
              <AlertDescription>
                سيبدأ فك التشفير والتحقق والاستعادة إلى قاعدة prod_restore_* فقط.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={step === 1 ? onOpenChange : () => setStep(step - 1)}>
            {step === 1 ? "إلغاء" : "السابق"}
          </Button>
          {step < 5 ? (
            <Button className="cursor-pointer" disabled={step === 4 && !confirmed} onClick={() => setStep(step + 1)}>
              التالي
            </Button>
          ) : (
            <Button variant="destructive" className="cursor-pointer" disabled={submitting || !confirmed} onClick={() => void start()}>
              {submitting ? "جارٍ البدء..." : "بدء إنشاء قاعدة الاستعادة المرشحة"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <input type="radio" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
