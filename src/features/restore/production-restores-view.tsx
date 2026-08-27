"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, productionRestoreStageLabel } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeAr, shortId } from "@/lib/format";

type RestoreRow = {
  id: string;
  status: string;
  progressStage: string;
  candidateDatabaseName: string;
  previousDatabaseName: string | null;
  cutoverCompleted: boolean;
  rollbackAvailableUntil: string | null;
  durationMs: number | null;
  errorReferenceId: string | null;
  backup: { backupNumber: number };
};

type Detail = RestoreRow & {
  originalDatabaseName: string;
  tableCount: number | null;
  errorMessage: string | null;
  criticalState: string | null;
  events: Array<{
    id: string;
    level: "INFO" | "WARNING" | "CRITICAL";
    messageCode: string;
    stage: string;
    createdAt: string;
  }>;
};

export function ProductionRestoresView() {
  const [items, setItems] = useState<RestoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [actions, setActions] = useState({ canCutover: false, canDropPrevious: false });
  const [action, setAction] = useState<"cutover" | "drop" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/production-restores");
    const json = await response.json();
    setItems(json.items ?? []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    const response = await fetch(`/api/production-restores/${selectedId}`);
    const json = await response.json();
    if (response.ok) {
      setDetail(json.restore);
      setActions(json.actions);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    void loadDetail();
    if (!selectedId) return;
    const timer = setInterval(() => void loadDetail(), 3000);
    return () => clearInterval(timer);
  }, [loadDetail, selectedId]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">استعادة الإنتاج</h1>
        <p className="text-sm text-muted-foreground">قواعد مرشحة، تبديل مؤكد، وسجل تعافٍ لا يحذف الإنتاج تلقائياً.</p>
      </div>
      <Alert>
        <AlertDescription>
          كل عملية تتوقف بعد التحقق من القاعدة المرشحة. التبديل إجراء مستقل يتطلب
          إيقاف التطبيق المصدر وإعادة إدخال كلمة المرور.
        </AlertDescription>
      </Alert>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد عمليات استعادة إنتاج بعد.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المعرّف</TableHead>
                <TableHead>النسخة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead>المرشحة</TableHead>
                <TableHead>السابقة</TableHead>
                <TableHead>التراجع حتى</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono" dir="ltr">{shortId(item.id)}</TableCell>
                  <TableCell>{item.backup.backupNumber}</TableCell>
                  <TableCell><StatusBadge value={item.status} /></TableCell>
                  <TableCell>{productionRestoreStageLabel[item.progressStage] ?? item.progressStage}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{item.candidateDatabaseName}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{item.previousDatabaseName ?? "—"}</TableCell>
                  <TableCell>{formatDateTimeAr(item.rollbackAvailableUntil)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                      التفاصيل
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog
        open={Boolean(selectedId) && !action}
        onOpenChange={(open) => !open && !action && setSelectedId(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل استعادة الإنتاج</DialogTitle>
            <DialogDescription>السجل التالي منقح ولا يحتوي على كلمات مرور أو روابط اتصال.</DialogDescription>
          </DialogHeader>
          {!detail ? <Skeleton className="h-64" /> : (
            <div className="space-y-4">
              {(detail.progressStage === "ROLLBACK_REQUIRED" || detail.criticalState) ? (
                <Alert variant="destructive">
                  <AlertTitle>تدخل تشغيلي مطلوب</AlertTitle>
                  <AlertDescription>
                    لا تنفذ حذفاً أو إعادة محاولة عمياء. اتبع docs/PRODUCTION_RESTORE_RUNBOOK.md
                    وراجع مرجع الخطأ {detail.errorReferenceId ?? "—"}.
                  </AlertDescription>
                </Alert>
              ) : null}
              {detail.status === "AWAITING_EXTERNAL_CUTOVER" ? (
                <Alert>
                  <AlertTitle>التبديل الخارجي مطلوب</AlertTitle>
                  <AlertDescription>
                    تعذر RENAME بأمان. حدّث DATABASE_URL للتطبيق المصدر إلى القاعدة
                    المرشحة خارج مركز النسخ ثم أعد تشغيله وفق دليل التشغيل.
                  </AlertDescription>
                </Alert>
              ) : null}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">الأصلية</dt><dd className="font-mono" dir="ltr">{detail.originalDatabaseName}</dd></div>
                <div><dt className="text-muted-foreground">المرشحة</dt><dd className="font-mono" dir="ltr">{detail.candidateDatabaseName}</dd></div>
                <div><dt className="text-muted-foreground">السابقة</dt><dd className="font-mono" dir="ltr">{detail.previousDatabaseName ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">عدد الجداول</dt><dd>{detail.tableCount ?? "—"}</dd></div>
              </dl>
              <div>
                <h2 className="mb-2 text-sm font-semibold">سجل المراحل</h2>
                <ol className="space-y-2">
                  {detail.events.map((item) => (
                    <li key={item.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{productionRestoreStageLabel[item.stage] ?? item.stage}</span>
                        <span className={item.level === "CRITICAL" ? "font-semibold text-destructive" : "text-muted-foreground"}>
                          {item.level === "CRITICAL" ? "حرج" : item.level === "WARNING" ? "تحذير" : "معلومة"}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs" dir="ltr">{item.messageCode}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeAr(item.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-2">
                {actions.canCutover ? (
                  <Button variant="destructive" className="cursor-pointer" onClick={() => setAction("cutover")}>بدء التبديل</Button>
                ) : null}
                {actions.canDropPrevious ? (
                  <Button variant="destructive" className="cursor-pointer" onClick={() => setAction("drop")}>حذف قاعدة التراجع</Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DestructiveActionDialog
        action={action}
        detail={detail}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          void load();
          void loadDetail();
        }}
      />
    </div>
  );
}

function DestructiveActionDialog({
  action,
  detail,
  onClose,
  onDone,
}: {
  action: "cutover" | "drop" | null;
  detail: Detail | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requiredPhrase = action === "cutover" ? "تبديل-الإنتاج" : "حذف-قاعدة-التراجع";
  const valid =
    acknowledged &&
    phrase === requiredPhrase &&
    number === String(detail?.backup.backupNumber) &&
    password.length > 0;

  useEffect(() => {
    setAcknowledged(false);
    setPhrase("");
    setNumber("");
    setPassword("");
  }, [action]);

  async function submit() {
    if (!action || !detail || !valid || submitting) return;
    setSubmitting(true);
    const endpoint = action === "cutover" ? "cutover" : "drop-previous";
    const body = action === "cutover"
      ? { confirmationPhrase: phrase, backupNumber: Number(number), acknowledgeDowntime: true, currentPassword: password }
      : { confirmationPhrase: phrase, backupNumber: Number(number), acknowledgeNoRollback: true, currentPassword: password };
    try {
      const response = await fetch(`/api/production-restores/${detail.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.message || "تعذر تنفيذ الإجراء");
        return;
      }
      toast.success(action === "cutover" ? "اكتملت محاولة التبديل" : "تم حذف قاعدة التراجع");
      onDone();
    } catch {
      toast.error("تعذر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "cutover" ? "تأكيد تبديل الإنتاج" : "تأكيد حذف قاعدة التراجع"}</DialogTitle>
          <DialogDescription>
            {action === "cutover"
              ? "أوقف التطبيق المصدر والـ workers وأفرغ اتصالات PostgreSQL قبل المتابعة."
              : "هذا الإجراء نهائي ويلغي إمكانية الرجوع إلى القاعدة السابقة."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={acknowledged} onCheckedChange={(value) => setAcknowledged(value === true)} />
            <span>{action === "cutover" ? "أؤكد توقف التطبيق المصدر وعدم وجود اتصالات مفتوحة." : "أفهم أن قاعدة التراجع ستُحذف نهائياً."}</span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="destructive-phrase">اكتب {requiredPhrase}</Label>
            <Input id="destructive-phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destructive-number">رقم النسخة</Label>
            <Input id="destructive-number" dir="ltr" inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destructive-password">كلمة المرور الحالية</Label>
            <Input id="destructive-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={onClose}>إلغاء</Button>
          <Button variant="destructive" className="cursor-pointer" disabled={!valid || submitting} onClick={() => void submit()}>
            {submitting ? "جارٍ التنفيذ..." : action === "cutover" ? "تنفيذ التبديل" : "حذف قاعدة التراجع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
