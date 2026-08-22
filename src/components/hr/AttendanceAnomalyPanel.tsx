import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { severityMeta } from "@/lib/ui/status";
import { formatDateShort } from "@/lib/ui/format";
import type { AttendanceAnomaly } from "@/lib/services/anomaly.service";

const typeLabel: Record<AttendanceAnomaly["type"], string> = {
  REPEATED_LATE: "Repeated late check-ins",
  MISSING_CHECKOUT: "Missing checkout",
  LONG_WORKING_HOURS: "Unusually long working hours",
  FREQUENT_HALF_DAYS: "Frequent half-days",
};

export function AttendanceAnomalyPanel({ anomalies, compact = false }: { anomalies: AttendanceAnomaly[]; compact?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[var(--df-warning)]" /> Attendance anomalies
        </CardTitle>
        <CardDescription>Rule-based, explainable — every flag lists exactly why and which dates triggered it. Not machine learning.</CardDescription>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <EmptyState title="No anomalies detected" description="Nothing unusual found in the last 30 days of attendance data." />
        ) : (
          <ul className="space-y-3">
            {anomalies.slice(0, compact ? 3 : undefined).map((a) => (
              <li key={a.id} className="rounded-[var(--df-radius-md)] border border-[var(--df-border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--df-text-primary)]">{typeLabel[a.type]}</p>
                    <Badge tone={severityMeta[a.severity].tone}>{severityMeta[a.severity].label}</Badge>
                  </div>
                  {!compact && (
                    <Link href={`/hr/employees/${a.employeeId}`} className="text-xs font-medium text-[var(--df-accent)] hover:underline">
                      {a.employeeName}
                    </Link>
                  )}
                  {compact && <span className="text-xs text-[var(--df-text-muted)]">{a.employeeName}</span>}
                </div>
                <p className="mt-1.5 text-xs text-[var(--df-text-secondary)]">{a.reason}</p>
                <p className="mt-1 text-[11px] text-[var(--df-text-muted)]">
                  Dates: {a.dates.slice(0, 6).map(formatDateShort).join(", ")}
                  {a.dates.length > 6 ? ` +${a.dates.length - 6} more` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
