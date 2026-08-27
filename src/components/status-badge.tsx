import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleAlert, CircleDashed, LoaderCircle, ShieldAlert, Unplug, Wifi } from "lucide-react";

const map: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  SUCCESS: { label: "ناجح", className: "bg-emerald-700/15 text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  FAILED: { label: "فشل", className: "bg-red-600/15 text-red-700 dark:text-red-300", icon: CircleAlert },
  RUNNING: { label: "قيد التنفيذ", className: "bg-blue-600/15 text-blue-800 dark:text-blue-300", icon: LoaderCircle },
  PENDING: { label: "قيد الانتظار", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300", icon: CircleDashed },
  INTERRUPTED: { label: "انقطعت", className: "bg-amber-600/15 text-amber-800 dark:text-amber-300", icon: ShieldAlert },
  VALID: { label: "صالح", className: "bg-emerald-700/15 text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  INVALID: { label: "غير صالح", className: "bg-red-600/15 text-red-700 dark:text-red-300", icon: CircleAlert },
  NOT_CHECKED: { label: "لم يُفحص", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300", icon: CircleDashed },
  MANUAL: { label: "يدوي", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300", icon: CircleDashed },
  SCHEDULED: { label: "تلقائي", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300", icon: CircleDashed },
  CONNECTED: { label: "متصل", className: "bg-emerald-700/15 text-emerald-800 dark:text-emerald-300", icon: Wifi },
  OFFLINE: { label: "غير متصل", className: "bg-red-600/15 text-red-700 dark:text-red-300", icon: Unplug },
  INCOMPATIBLE: { label: "غير متوافق", className: "bg-amber-600/15 text-amber-800 dark:text-amber-300", icon: ShieldAlert },
};

export function StatusBadge({ value }: { value: string }) {
  const item = map[value] ?? { label: value, className: "", icon: CircleDashed };
  const Icon = item.icon;
  return (
    <Badge variant="secondary" className={`gap-1 font-medium ${item.className}`}>
      <Icon className={`size-3 ${value === "RUNNING" ? "animate-spin" : ""}`} aria-hidden />
      {item.label}
    </Badge>
  );
}

export const backupStageLabel: Record<string, string> = {
  PREPARING: "التحضير",
  DUMPING: "إنشاء النسخة",
  VALIDATING: "التحقق من السلامة",
  ENCRYPTING: "التشفير",
  SAVING: "الحفظ",
  FINALIZING: "الإنهاء",
};

export const restoreStageLabel: Record<string, string> = {
  PREPARING: "التحضير",
  DECRYPTING: "فك التشفير",
  VERIFYING: "التحقق من SHA-256",
  CREATING_DATABASE: "إنشاء قاعدة مؤقتة",
  RESTORING: "الاستعادة",
  VALIDATING: "فحوصات التحقق",
  CLEANING_UP: "التنظيف",
  COMPLETED: "اكتملت",
};
