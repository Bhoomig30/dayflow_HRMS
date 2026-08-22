import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireHrForPage } from "@/lib/auth/pageGuards";
import { EmployeeProfileView } from "@/components/profile/EmployeeProfileView";
import { AttendanceAnomalyPanel } from "@/components/hr/AttendanceAnomalyPanel";
import { detectAnomaliesForEmployee } from "@/lib/services/anomaly.service";

export default async function HrEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireHrForPage();
  const { id } = await params;
  const anomalies = await detectAnomaliesForEmployee(id);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/hr/employees" className="inline-flex items-center gap-1.5 text-sm text-[var(--df-text-muted)] hover:text-[var(--df-text-primary)]">
        <ArrowLeft className="size-4" /> Back to employees
      </Link>
      {anomalies.length > 0 && <AttendanceAnomalyPanel anomalies={anomalies} compact />}
      <EmployeeProfileView employeeId={id} viewerRole="HR" />
    </div>
  );
}
