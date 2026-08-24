"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, restoreStageLabel } from "@/components/status-badge";
import { formatDateTimeAr, shortId } from "@/lib/format";

type Row = {
  id: string;
  status: string;
  progressStage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  tempDatabaseDropped: boolean;
  tableCount: number | null;
  integrityVerified: boolean;
  validationSummary: string | null;
  errorMessage: string | null;
  backup: { backupNumber: number };
};

export function RestoreTestsView() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/restore-tests");
      const json = await response.json();
      setItems(json.items ?? []);
      setLoading(false);
    }
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">اختبارات الاستعادة</h1>
        <p className="text-sm text-muted-foreground">نتائج الاختبار اليدوي على قواعد مؤقتة تُحذف بعد الفحص.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد اختبارات بعد.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المعرّف</TableHead>
                <TableHead>النسخة</TableHead>
                <TableHead>البداية</TableHead>
                <TableHead>النهاية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المدة</TableHead>
                <TableHead>تنظيف القاعدة</TableHead>
                <TableHead>الجداول</TableHead>
                <TableHead>السلامة</TableHead>
                <TableHead>التحقق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono" dir="ltr">{shortId(item.id)}</TableCell>
                  <TableCell>{item.backup.backupNumber}</TableCell>
                  <TableCell>{formatDateTimeAr(item.startedAt)}</TableCell>
                  <TableCell>{formatDateTimeAr(item.completedAt)}</TableCell>
                  <TableCell>
                    <StatusBadge value={item.status} />
                    {item.progressStage && item.status === "RUNNING" ? (
                      <span className="ms-2 text-xs">{restoreStageLabel[item.progressStage]}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{item.durationMs ? `${Math.round(item.durationMs / 1000)} ث` : "—"}</TableCell>
                  <TableCell>{item.tempDatabaseDropped ? "تم الحذف" : "لم يُحذف"}</TableCell>
                  <TableCell>{item.tableCount ?? "—"}</TableCell>
                  <TableCell>{item.integrityVerified ? "مطابق" : "—"}</TableCell>
                  <TableCell>{item.validationSummary || item.errorMessage || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
