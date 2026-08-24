"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DatabaseBackup } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, backupStageLabel } from "@/components/status-badge";
import { formatBytes } from "@/lib/format";
import { ConfirmBackupDialog } from "@/features/backup/confirm-backup-dialog";
import { JobProgress } from "@/features/backup/job-progress";

type DashboardData = {
  source: { connected: boolean; latencyMs: number | null; serverVersion: string | null; incompatible: boolean };
  lastSuccess: { completedAt: string | null; createdAt: string } | null;
  lastBackup: { status: string; progressStage: string | null; errorMessage: string | null; errorReferenceId: string | null } | null;
  lastRestore: { status: string } | null;
  nextScheduledBackupAt: string | null;
  scheduleEnabled: boolean;
  backupLocalTime: string;
  timezone: string;
  notificationEmail: string | null;
  backupCount: number;
  retention: number;
  totalEncryptedBytes: string;
  disk: {
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
    warning: boolean;
    critical: boolean;
  } | null;
  jobs: { backup: boolean; restore: boolean; busy: boolean };
  issues: { code: string; message: string; blocksBackup: boolean }[];
};

function formatWhen(value: string | null, timezone: string) {
  if (!value) return "لا يوجد";
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard");
    if (!response.ok) {
      setError("تعذر تحميل لوحة المعلومات.");
      return;
    }
    setData(await response.json());
    setError(null);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const backupDisabledReason = useMemo(() => {
    if (!data) return "جارٍ التحميل";
    if (data.jobs.backup) return "توجد عملية نسخ قيد التنفيذ";
    if (data.jobs.restore) return "يوجد اختبار استعادة قيد التنفيذ";
    const blocking = data.issues.find((issue) => issue.blocksBackup);
    if (blocking) return blocking.message;
    return null;
  }, [data]);

  async function startBackup() {
    const response = await fetch("/api/backups", { method: "POST" });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.message || "تعذر بدء النسخ الاحتياطي");
      return;
    }
    setJobId(json.jobId);
    toast.success("بدأت عملية النسخ الاحتياطي");
    void load();
  }

  if (!data && !error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">الرئيسية</h1>
          <p className="text-sm text-muted-foreground">نظرة عامة على حالة النسخ الاحتياطية والتخزين.</p>
        </div>
        <Button
          className="cursor-pointer"
          disabled={Boolean(backupDisabledReason)}
          onClick={() => setConfirmOpen(true)}
        >
          <DatabaseBackup className="size-4" />
          إنشاء نسخة احتياطية الآن
        </Button>
      </div>
      {backupDisabledReason ? (
        <p className="text-sm text-muted-foreground">الزر معطّل: {backupDisabledReason}</p>
      ) : null}

      <Alert>
        <AlertTitle>سياسة الاستعادة</AlertTitle>
        <AlertDescription>
          لأسباب أمنية، استعادة قاعدة البيانات الأساسية تتم يدوياً خارج النظام بعد التحقق من النسخة.
        </AlertDescription>
      </Alert>

      {data.issues.length > 0 ? (
        <Alert>
          <AlertTitle>قائمة إعدادات ناقصة</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pe-5">
              {data.issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {jobId || data.jobs.backup ? (
        <JobProgress
          jobId={jobId}
          fallbackStage={data.lastBackup?.progressStage}
          labels={backupStageLabel}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard title="قاعدة البيانات الأساسية" value={data.source.connected ? "متصلة" : "غير متصلة"} badge={data.source.connected ? "CONNECTED" : "OFFLINE"} helper={data.source.serverVersion || "—"} />
        <StatusCard title="آخر نسخة ناجحة" value={formatWhen(data.lastSuccess?.completedAt ?? null, data.timezone)} helper={data.lastSuccess ? "اكتملت بنجاح" : "لا توجد نسخ بعد"} />
        <StatusCard title="موعد النسخة القادمة" value={data.scheduleEnabled ? formatWhen(data.nextScheduledBackupAt, data.timezone) : "متوقف"} helper={`${data.backupLocalTime} — ${data.timezone}`} />
        <StatusCard title="عدد النسخ" value={`${data.backupCount} / ${data.retention}`} helper="ضمن سياسة الاحتفاظ" />
        <StatusCard title="إجمالي حجم النسخ" value={formatBytes(Number(data.totalEncryptedBytes))} helper="الملفات المشفرة" />
        <StatusCard title="حالة آخر نسخة" value={data.lastBackup?.status ?? "—"} badge={data.lastBackup?.status} helper={data.lastBackup?.errorReferenceId ? `مرجع: ${data.lastBackup.errorReferenceId}` : data.lastBackup?.progressStage ? backupStageLabel[data.lastBackup.progressStage] : "—"} />
        <StatusCard title="آخر اختبار استعادة" value={data.lastRestore?.status ?? "لا يوجد"} badge={data.lastRestore?.status} helper="يدوي فقط" />
        <StatusCard
          title="مساحة Persistent Disk"
          value={data.disk ? `${data.disk.usedPercent}%` : "غير متاح"}
          helper={data.disk ? `${formatBytes(data.disk.usedBytes)} مستخدم / ${formatBytes(data.disk.availableBytes)} متاح` : "تعذر قراءة المساحة"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>حالة سريعة</CardTitle>
          <CardDescription>النسخ التلقائي، التنبيهات، وصحة النظام.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>النسخ التلقائي: {data.scheduleEnabled ? "مفعّل" : "متوقف"}</p>
          <p>الجدول: كل يومين الساعة {data.backupLocalTime}</p>
          <p>بريد التنبيهات: {data.notificationEmail || "غير مضبوط"}</p>
          <p>صحة النظام: {data.jobs.busy ? "عملية قيد التنفيذ" : data.source.connected ? "جاهز" : "المصدر غير متصل"}</p>
        </CardContent>
      </Card>

      <ConfirmBackupDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={startBackup} />
    </div>
  );
}

function StatusCard({
  title,
  value,
  helper,
  badge,
}: {
  title: string;
  value: string;
  helper: string;
  badge?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{helper}</span>
        {badge ? <StatusBadge value={badge} /> : null}
      </CardContent>
    </Card>
  );
}
