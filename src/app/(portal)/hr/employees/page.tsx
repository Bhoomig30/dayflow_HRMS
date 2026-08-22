import { requireHrForPage } from "@/lib/auth/pageGuards";
import { EmployeeDirectory } from "@/components/hr/EmployeeDirectory";

export default async function HrEmployeesPage() {
  await requireHrForPage();
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Employees</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Directory and account management.</p>
      </div>
      <EmployeeDirectory />
    </div>
  );
}
