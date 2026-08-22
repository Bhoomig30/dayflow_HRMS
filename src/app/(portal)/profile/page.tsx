import { requireSessionForPage } from "@/lib/auth/pageGuards";
import { EmployeeProfileView } from "@/components/profile/EmployeeProfileView";

export default async function MyProfilePage() {
  const session = await requireSessionForPage();
  return (
    <div className="mx-auto max-w-4xl">
      <EmployeeProfileView employeeId={session.employeeId} viewerRole={session.role} />
    </div>
  );
}
