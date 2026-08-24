"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, backupStageLabel } from "@/components/status-badge";
import { formatBytes, formatDateTimeAr, shortId } from "@/lib/format";
import { BackupDetailsDialog } from "@/features/backup/backup-details-dialog";
import { DeleteBackupDialog } from "@/features/backup/delete-backup-dialog";
import { RestoreTestDialog } from "@/features/restore/restore-test-dialog";

type BackupRow = {
  id: string;
  backupNumber: number;
  type: string;
  status: string;
  progressStage: string | null;
  integrityStatus: string;
  fileName: string | null;
  encryptedSizeBytes: string | null;
  durationMs: number | null;
  createdAt: string;
  errorMessage: string | null;
  errorReferenceId: string | null;
  deletedAt: string | null;
  initiatedBy?: { email: string } | null;
};

export function BackupsView() {
  const [items, setItems] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BackupRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (query) params.set("q", query);
    const response = await fetch(`/api/backups?${params.toString()}`);
    const json = await response.json();
    setItems(json.items ?? []);
    setLoading(false);
  }, [status, type, query]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return <Skeleton className="h-80" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">النسخ الاحتياطية</h1>
        <p className="text-sm text-muted-foreground">عرض، تنزيل، اختبار الاستعادة، أو حذف النسخ المشفرة.</p>
      </div>
      <Alert>
        <AlertDescription>
          لأسباب أمنية، استعادة قاعدة البيانات الأساسية تتم يدوياً خارج النظام بعد التحقق من النسخة.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="بحث بالمعرّف" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-56" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="SUCCESS">ناجح</SelectItem>
            <SelectItem value="FAILED">فشل</SelectItem>
            <SelectItem value="RUNNING">قيد التنفيذ</SelectItem>
            <SelectItem value="INTERRUPTED">انقطعت</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="MANUAL">يدوي</SelectItem>
            <SelectItem value="SCHEDULED">تلقائي</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد نسخ احتياطية بعد. أنشئ نسخة من الرئيسية.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المعرّف</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>السلامة</TableHead>
                <TableHead>الحجم</TableHead>
                <TableHead>المدة</TableHead>
                <TableHead>بواسطة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono dir-ltr" dir="ltr">{shortId(item.id)}</TableCell>
                  <TableCell><StatusBadge value={item.type} /></TableCell>
                  <TableCell>{formatDateTimeAr(item.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge value={item.status} />
                    {item.progressStage && item.status === "RUNNING" ? (
                      <span className="ms-2 text-xs text-muted-foreground">{backupStageLabel[item.progressStage]}</span>
                    ) : null}
                  </TableCell>
                  <TableCell><StatusBadge value={item.integrityStatus} /></TableCell>
                  <TableCell>{item.encryptedSizeBytes ? formatBytes(Number(item.encryptedSizeBytes)) : "—"}</TableCell>
                  <TableCell>{item.durationMs ? `${Math.round(item.durationMs / 1000)} ث` : "—"}</TableCell>
                  <TableCell>{item.initiatedBy?.email ?? "النظام"}</TableCell>
                  <TableCell className="space-x-1 space-x-reverse">
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setSelected(item)}>التفاصيل</Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer" disabled={!item.fileName || Boolean(item.deletedAt)} onClick={() => window.open(`/api/backups/${item.id}/download`)}>تنزيل</Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer" disabled={item.status !== "SUCCESS" || Boolean(item.deletedAt)} onClick={() => setRestoreTarget(item)}>اختبار الاستعادة</Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer text-destructive" disabled={item.status === "RUNNING"} onClick={() => setDeleteTarget(item)}>حذف</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <BackupDetailsDialog backup={selected} onOpenChange={() => setSelected(null)} />
      <DeleteBackupDialog backup={deleteTarget} onOpenChange={() => setDeleteTarget(null)} onDeleted={() => { toast.success("تم حذف النسخة"); void load(); }} />
      <RestoreTestDialog backup={restoreTarget} onOpenChange={() => setRestoreTarget(null)} onStarted={() => toast.success("بدأ اختبار الاستعادة")} />
    </div>
  );
}
