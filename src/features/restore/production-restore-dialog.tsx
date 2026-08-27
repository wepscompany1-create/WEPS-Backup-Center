"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  matchesProductionRestorePhrase,
  PRODUCTION_RESTORE_PHRASE,
} from "@/features/restore/confirmation";

type BackupTarget = {
  id: string;
  backupNumber: number;
  createdAt: string;
  encryptedSizeBytes: string | null;
  integrityStatus: string;
};

type Step4Errors = {
  acknowledged?: string;
  phrase?: string;
  backupNumber?: string;
  password?: string;
};

function phraseErrorMessage(value: string) {
  if (!value.trim()) return "يلزم كتابة عبارة التأكيد.";
  if (value.includes(" ") && !value.includes("-")) {
    return `العبارة يجب أن تُكتب بشرطة وليس مسافة: ${PRODUCTION_RESTORE_PHRASE}`;
  }
  return `العبارة يجب أن تطابق ${PRODUCTION_RESTORE_PHRASE} حرفياً (بشرطة).`;
}

export function ProductionRestoreDialog({
  backup,
  onOpenChange,
  onStarted,
}: {
  backup: BackupTarget | null;
  onOpenChange: () => void;
  onStarted: (jobId: string) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"RESTORE_ONLY" | "RESTORE_AND_CUTOVER">("RESTORE_ONLY");
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [backupNumber, setBackupNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step4Errors, setStep4Errors] = useState<Step4Errors>({});

  useEffect(() => {
    if (!backup) return;
    setStep(1);
    setMode("RESTORE_ONLY");
    setAcknowledged(false);
    setPhrase("");
    setBackupNumber("");
    setPassword("");
    setStep4Errors({});
  }, [backup]);

  const confirmed =
    acknowledged &&
    matchesProductionRestorePhrase(phrase) &&
    backupNumber === String(backup?.backupNumber) &&
    password.length > 0;

  function validateStep4(): Step4Errors {
    const errors: Step4Errors = {};
    if (!acknowledged) errors.acknowledged = "يلزم تأكيد الفهم قبل المتابعة.";
    if (!matchesProductionRestorePhrase(phrase)) errors.phrase = phraseErrorMessage(phrase);
    if (backupNumber !== String(backup?.backupNumber)) errors.backupNumber = "رقم النسخة غير مطابق.";
    if (password.length === 0) errors.password = "يلزم إدخال كلمة المرور الحالية.";
    return errors;
  }

  function goNext() {
    if (step !== 4) {
      setStep(step + 1);
      return;
    }
    const errors = validateStep4();
    if (Object.keys(errors).length > 0) {
      setStep4Errors(errors);
      return;
    }
    setStep4Errors({});
    setStep(5);
  }

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
      router.push("/production-restores");
    } catch {
      toast.error("تعذر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(backup)} onOpenChange={(open) => !open && onOpenChange()}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>استعادة الإنتاج — الخطوة {step} من 5</DialogTitle>
          <DialogDescription>
            تُنشأ قاعدة مرشحة منفصلة أولاً. لا يحدث التبديل في هذه العملية.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === 1 && backup ? (
            <div className="space-y-3 text-sm">
              <p>رقم النسخة: <strong>{backup.backupNumber}</strong></p>
              <p>التاريخ: {formatDateTimeAr(backup.createdAt)}</p>
              <p>الحجم: {backup.encryptedSizeBytes ? formatBytes(Number(backup.encryptedSizeBytes)) : "—"}</p>
              <div className="flex items-center gap-2">السلامة: <StatusBadge value={backup.integrityStatus} /></div>
              <p className="text-muted-foreground">
                يلزم اختبار استعادة ناجح لنفس النسخة قبل بدء استعادة الإنتاج. يتحقق الخادم من ذلك عند الإرسال.
              </p>
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
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="production-acknowledge"
                    className="mt-0.5"
                    checked={acknowledged}
                    onCheckedChange={(value) => {
                      setAcknowledged(value === true);
                      setStep4Errors((current) => ({ ...current, acknowledged: undefined }));
                    }}
                    aria-invalid={Boolean(step4Errors.acknowledged)}
                    aria-describedby={step4Errors.acknowledged ? "production-acknowledge-error" : undefined}
                  />
                  <Label htmlFor="production-acknowledge" className="text-sm font-normal leading-5">
                    أفهم أن التبديل اللاحق سيستبدل قاعدة الإنتاج الحالية وأنه لا يتم تلقائياً.
                  </Label>
                </div>
                {step4Errors.acknowledged ? (
                  <p id="production-acknowledge-error" className="text-sm text-destructive">
                    {step4Errors.acknowledged}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="production-phrase">اكتب {PRODUCTION_RESTORE_PHRASE}</Label>
                <p className="text-xs text-muted-foreground">
                  العبارة المطلوبة حرفياً بشرطة وليست مسافة: {PRODUCTION_RESTORE_PHRASE}
                </p>
                <Input
                  id="production-phrase"
                  value={phrase}
                  aria-invalid={Boolean(step4Errors.phrase)}
                  aria-describedby={step4Errors.phrase ? "production-phrase-error" : undefined}
                  onChange={(event) => {
                    setPhrase(event.target.value);
                    setStep4Errors((current) => ({ ...current, phrase: undefined }));
                  }}
                />
                {step4Errors.phrase ? (
                  <p id="production-phrase-error" className="text-sm text-destructive">
                    {step4Errors.phrase}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="production-backup-number">رقم النسخة</Label>
                <Input
                  id="production-backup-number"
                  inputMode="numeric"
                  dir="ltr"
                  value={backupNumber}
                  aria-invalid={Boolean(step4Errors.backupNumber)}
                  aria-describedby={step4Errors.backupNumber ? "production-backup-number-error" : undefined}
                  onChange={(event) => {
                    setBackupNumber(event.target.value);
                    setStep4Errors((current) => ({ ...current, backupNumber: undefined }));
                  }}
                />
                {step4Errors.backupNumber ? (
                  <p id="production-backup-number-error" className="text-sm text-destructive">
                    {step4Errors.backupNumber}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="production-password">كلمة المرور الحالية</Label>
                <Input
                  id="production-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={Boolean(step4Errors.password)}
                  aria-describedby={step4Errors.password ? "production-password-error" : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setStep4Errors((current) => ({ ...current, password: undefined }));
                  }}
                />
                {step4Errors.password ? (
                  <p id="production-password-error" className="text-sm text-destructive">
                    {step4Errors.password}
                  </p>
                ) : null}
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
        </div>

        <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={step === 1 ? onOpenChange : () => setStep(step - 1)}
          >
            {step === 1 ? "إلغاء" : "السابق"}
          </Button>
          {step < 5 ? (
            <Button type="button" className="cursor-pointer" onClick={goNext}>
              التالي
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              disabled={submitting || !confirmed}
              onClick={() => void start()}
            >
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
