"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export function JobProgress({
  jobId,
  fallbackStage,
  labels,
}: {
  jobId?: string | null;
  fallbackStage?: string | null;
  labels: Record<string, string>;
}) {
  const [stage, setStage] = useState(fallbackStage || "PREPARING");
  const [status, setStatus] = useState("RUNNING");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) return;
      const json = await response.json();
      const job = json.job;
      setStatus(job.status);
      setStage(job.progressStage || stage);
      if (job.errorMessage) setError(`${job.errorMessage} — ${job.errorReferenceId ?? ""}`);
      if (["SUCCESS", "FAILED", "INTERRUPTED"].includes(job.status)) {
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [jobId, stage]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          العملية قيد التنفيذ
          <StatusBadge value={status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ol className="grid gap-1">
          {Object.entries(labels).map(([key, label]) => (
            <li key={key} className={key === stage ? "font-medium text-foreground" : "text-muted-foreground"}>
              {label}
              {key === stage ? " — الحالية" : ""}
            </li>
          ))}
        </ol>
        {error ? <p className="text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
