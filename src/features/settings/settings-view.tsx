"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeAr } from "@/lib/format";

type Payload = {
  settings: {
    scheduleEnabled: boolean;
    backupIntervalDays: number;
    backupLocalTime: string;
    timezone: string;
    nextScheduledBackupAt: string | null;
    notificationEmail: string | null;
    notifyOnBackupSuccess: boolean;
    notifyOnBackupFailure: boolean;
    notifyOnRestoreSuccess: boolean;
    notifyOnRestoreFailure: boolean;
    notifyOnIntegrityFailure: boolean;
  };
  system: {
    backupDir: string;
    retention: number;
    encryption: string;
    timezone: string;
    pgTools: Record<string, string> | null;
    disk: { usedPercent: number } | null;
    appVersion: string;
  };
};

export function SettingsView() {
  const [data, setData] = useState<Payload | null>(null);
  const [email, setEmail] = useState("");
  const [time, setTime] = useState("03:00");
  const [enabled, setEnabled] = useState(true);

  async function load() {
    const response = await fetch("/api/settings");
    const json = (await response.json()) as Payload;
    setData(json);
    setEmail(json.settings.notificationEmail || "");
    setTime(json.settings.backupLocalTime);
    setEnabled(json.settings.scheduleEnabled);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(partial: Record<string, unknown>) {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    if (!response.ok) {
      toast.error("تعذر حفظ الإعدادات");
      return;
    }
    toast.success("تم حفظ الإعدادات");
    await load();
  }

  async function testSource() {
    const response = await fetch("/api/settings/test-source", { method: "POST" });
    const json = await response.json();
    if (json.success) {
      toast.success(`الاتصال ناجح — ${json.latencyMs}ms — PostgreSQL ${json.serverVersion}`);
    } else {
      toast.error(json.incompatible ? "إصدار العميل غير متوافق مع الخادم" : "فشل الاتصال بقاعدة المصدر");
    }
  }

  async function testEmail() {
    const response = await fetch("/api/settings/test-email", { method: "POST" });
    const json = await response.json();
    if (json.sent) toast.success("أُرسلت رسالة الاختبار");
    else toast.error("تعذر إرسال رسالة الاختبار");
  }

  if (!data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">الجدولة والتنبيهات ومعلومات النظام للقراءة فقط.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>جدول النسخ التلقائي</CardTitle>
          <CardDescription>كل يومين في الوقت المحدد حسب Asia/Aden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="schedule">تفعيل النسخ التلقائي</Label>
            <Switch id="schedule" checked={enabled} onCheckedChange={(value) => { setEnabled(value); void save({ scheduleEnabled: value }); }} />
          </div>
          <p className="text-sm">الفاصل: كل {data.settings.backupIntervalDays} يوم</p>
          <div className="space-y-2">
            <Label htmlFor="time">الوقت المحلي</Label>
            <Input id="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="max-w-40" />
          </div>
          <p className="text-sm">المنطقة الزمنية: {data.settings.timezone}</p>
          <p className="text-sm">الموعد التالي: {formatDateTimeAr(data.settings.nextScheduledBackupAt, data.settings.timezone)}</p>
          <Button className="cursor-pointer" onClick={() => void save({ backupLocalTime: time })}>
            حفظ الوقت
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>التنبيهات</CardTitle>
          <CardDescription>البريد المستلم قابل للتعديل. مفاتيح Resend تبقى في بيئة التشغيل.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notify-email">بريد التنبيهات</Label>
            <Input id="notify-email" type="email" dir="ltr" className="max-w-md text-left" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <Button className="cursor-pointer" onClick={() => void save({ notificationEmail: email || null })}>
            حفظ البريد
          </Button>
          <Toggle label="نجاح النسخ" checked={data.settings.notifyOnBackupSuccess} onChange={(value) => void save({ notifyOnBackupSuccess: value })} />
          <Toggle label="فشل النسخ" checked={data.settings.notifyOnBackupFailure} onChange={(value) => void save({ notifyOnBackupFailure: value })} />
          <Toggle label="نجاح الاستعادة" checked={data.settings.notifyOnRestoreSuccess} onChange={(value) => void save({ notifyOnRestoreSuccess: value })} />
          <Toggle label="فشل الاستعادة" checked={data.settings.notifyOnRestoreFailure} onChange={(value) => void save({ notifyOnRestoreFailure: value })} />
          <Toggle label="فشل السلامة" checked={data.settings.notifyOnIntegrityFailure} onChange={(value) => void save({ notifyOnIntegrityFailure: value })} />
          <Button variant="outline" className="cursor-pointer" onClick={() => void testEmail()}>
            إرسال رسالة اختبار
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>النظام</CardTitle>
          <CardDescription>قيم للقراءة فقط. لا تُعرض الأسرار.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>مسار النسخ: <span className="font-mono" dir="ltr">{data.system.backupDir}</span></p>
          <p>سياسة الاحتفاظ: {data.system.retention}</p>
          <p>التشفير: {data.system.encryption}</p>
          <p>استخدام القرص: {data.system.disk ? `${data.system.disk.usedPercent}%` : "غير متاح"}</p>
          <p>أدوات PostgreSQL: {data.system.pgTools ? Object.values(data.system.pgTools).join(" | ") : "غير متوفرة"}</p>
          <p>إصدار التطبيق: {data.system.appVersion}</p>
          <Button variant="outline" className="cursor-pointer" onClick={() => void testSource()}>
            اختبار الاتصال
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
