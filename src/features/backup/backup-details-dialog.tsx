"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { formatBytes, formatDateTimeAr } from "@/lib/format";

type Details = {
  backup: {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    durationMs: number | null;
    originalDumpSizeBytes: string | null;
    encryptedSizeBytes: string | null;
    sha256: string | null;
    integrityStatus: string;
    pgDumpVersion: string | null;
    postgresServerVersion: string | null;
    errorMessage: string | null;
    errorReferenceId: string | null;
  };
  restoreTests: { id: string; status: string; createdAt: string }[];
};

export function BackupDetailsDialog({
  backup,
  onOpenChange,
}: {
  backup: { id: string } | null;
  onOpenChange: () => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);

  useEffect(() => {
    if (!backup) {
      setDetails(null);
      return;
    }
    void fetch(`/api/backups/${backup.id}`)
      .then((response) => response.json())
      .then(setDetails);
  }, [backup]);

  const row = details?.backup;

  return (
    <Dialog open={Boolean(backup)} onOpenChange={() => onOpenChange()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تفاصيل النسخة</DialogTitle>
          <DialogDescription>بيانات وصفية فقط. لا تُعرض أسرار الاتصال أو مفتاح التشفير.</DialogDescription>
        </DialogHeader>
        {row ? (
          <dl className="grid gap-2 text-sm">
            <Item label="المعرّف" value={row.id} mono />
            <Item label="النوع" value={<StatusBadge value={row.type} />} />
            <Item label="الحالة" value={<StatusBadge value={row.status} />} />
            <Item label="أُنشئت" value={formatDateTimeAr(row.createdAt)} />
            <Item label="اكتملت" value={formatDateTimeAr(row.completedAt)} />
            <Item label="المدة" value={row.durationMs ? `${Math.round(row.durationMs / 1000)} ثانية` : "—"} />
            <Item label="حجم الـ dump" value={row.originalDumpSizeBytes ? formatBytes(Number(row.originalDumpSizeBytes)) : "—"} />
            <Item label="الحجم المشفر" value={row.encryptedSizeBytes ? formatBytes(Number(row.encryptedSizeBytes)) : "—"} />
            <Item label="SHA-256" value={row.sha256 || "—"} mono />
            <Item label="السلامة" value={<StatusBadge value={row.integrityStatus} />} />
            <Item label="pg_dump" value={row.pgDumpVersion || "—"} />
            <Item label="PostgreSQL" value={row.postgresServerVersion || "—"} />
            <Item label="الخطأ" value={row.errorMessage ? `${row.errorMessage} (${row.errorReferenceId})` : "—"} />
            <div>
              <dt className="text-muted-foreground">اختبارات الاستعادة</dt>
              <dd>
                {details?.restoreTests.length
                  ? details.restoreTests.map((test) => (
                      <p key={test.id} className="font-mono text-xs">
                        {test.id} — {test.status}
                      </p>
                    ))
                  : "لا يوجد"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : undefined} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
