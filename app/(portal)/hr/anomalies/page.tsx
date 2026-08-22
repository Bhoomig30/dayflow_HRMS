import { requireHrForPage } from "@/lib/auth/pageGuards";
import { detectAnomaliesForWindow } from "@/lib/services/anomaly.service";
import { AttendanceAnomalyPanel } from "@/components/hr/AttendanceAnomalyPanel";

export default async function HrAnomaliesPage() {
  await requireHrForPage();
  const anomalies = await detectAnomaliesForWindow(30);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Attendance anomalies</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Explainable rules over the last 30 days of attendance records.</p>
      </div>
      <AttendanceAnomalyPanel anomalies={anomalies} />
    </div>
  );
}
