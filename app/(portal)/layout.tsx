import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEmployeeWithUser } from "@/lib/services/employee.service";
import { AppShell } from "@/components/layout/AppShell";

// Defense in depth: middleware already redirects unauthenticated requests
// away from this route group, but this server-side check is what actually
// decides what gets rendered — never trust the middleware pass alone.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const full = await getEmployeeWithUser(session.employeeId);
  if (!full) redirect("/sign-in");

  return (
    <AppShell
      user={{
        fullName: session.fullName,
        role: session.role,
        employeeCode: session.employeeCode,
        profilePhotoUrl: full.employee.profilePhotoUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
