"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeAr, shortId } from "@/lib/format";

type Row = {
  id: string;
  action: string;
  result: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { email: string } | null;
};

export function AuditView() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [result, setResult] = useState("all");

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (result !== "all") params.set("result", result);
      const response = await fetch(`/api/audit?${params.toString()}`);
      const json = await response.json();
      setItems(json.items ?? []);
      setLoading(false);
    }
    void load();
  }, [action, result]);

  if (loading) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">سجل التدقيق</h1>
        <p className="text-sm text-muted-foreground">عمليات حساسة بدون أسرار أو عناوين اتصال كاملة.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="الإجراء" value={action} onChange={(event) => setAction(event.target.value)} className="max-w-56" />
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل النتائج</SelectItem>
            <SelectItem value="SUCCESS">نجاح</SelectItem>
            <SelectItem value="FAILURE">فشل</SelectItem>
            <SelectItem value="WARNING">تحذير</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>المسؤول</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>النتيجة</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>المتصفح</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateTimeAr(item.createdAt)}</TableCell>
                  <TableCell>{item.actor?.email ?? "نظام"}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{item.action}</TableCell>
                  <TableCell><StatusBadge value={item.result === "FAILURE" ? "FAILED" : item.result} /></TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {item.resourceType ?? "—"} {item.resourceId ? shortId(item.resourceId) : ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{item.ipAddress ?? "—"}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs" title={item.userAgent ?? ""}>
                    {item.userAgent ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
