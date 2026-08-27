export type BackupReadinessInput = {
  jobs: { backup: boolean; restore: boolean };
  issues: { message: string; blocksBackup: boolean }[];
  source: { connected: boolean; incompatible: boolean };
};

export function getBackupDisabledReason(data: BackupReadinessInput): string | null {
  if (data.jobs.backup) return "توجد عملية نسخ قيد التنفيذ";
  if (data.jobs.restore) return "يوجد اختبار استعادة قيد التنفيذ";

  const blockingIssue = data.issues.find((issue) => issue.blocksBackup);
  if (blockingIssue) return blockingIssue.message;

  if (!data.source.connected) {
    return "قاعدة البيانات الأساسية غير متصلة. تحقق من رابط المصدر وإمكانية الوصول إليه.";
  }
  if (data.source.incompatible) {
    return "إصدار pg_dump أقدم من خادم PostgreSQL. حدّث أدوات PostgreSQL قبل إنشاء نسخة.";
  }

  return null;
}

export function getSourceStatusCard(source: {
  connected: boolean;
  incompatible: boolean;
  serverVersion: string | null;
}) {
  if (source.incompatible) {
    return {
      value: "غير متوافق",
      badge: "INCOMPATIBLE",
      helper: source.serverVersion
        ? `إصدار pg_dump أقدم من الخادم (${source.serverVersion})`
        : "إصدار pg_dump أقدم من خادم PostgreSQL",
    };
  }
  if (source.connected) {
    return {
      value: "متصلة",
      badge: "CONNECTED",
      helper: source.serverVersion || "—",
    };
  }
  return {
    value: "غير متصلة",
    badge: "OFFLINE",
    helper: source.serverVersion || "—",
  };
}
