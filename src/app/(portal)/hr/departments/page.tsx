import { requireHrForPage } from "@/lib/auth/pageGuards";
import { DepartmentsPanel } from "@/components/hr/DepartmentsPanel";

export default async function HrDepartmentsPage() {
  await requireHrForPage();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Departments</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Used for organizing employees and enabling team leave overlap checks.</p>
      </div>
      <DepartmentsPanel />
    </div>
  );
}
