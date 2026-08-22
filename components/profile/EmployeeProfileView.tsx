import Link from "next/link";
import { Mail, Phone, MapPin, Briefcase, Calendar, ShieldCheck } from "lucide-react";
import { getEmployeeWithUser, profileCompleteness } from "@/lib/services/employee.service";
import { listDepartments } from "@/lib/services/employee.service";
import { getEmployeeTimeline } from "@/lib/services/activity.service";
import { getAllPayrollForEmployee, getPublishedPayrollHistory } from "@/lib/services/payroll.service";
import { getAttendanceSummary } from "@/lib/services/attendance.service";
import { listLeaveRequestsForEmployee } from "@/lib/services/leave.service";
import { todayISO } from "@/lib/utils/date";
import { formatCurrency, formatDate, formatMonth, timeAgo } from "@/lib/ui/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ProfileEditForm } from "./ProfileEditForm";
import { DocumentsSection } from "./DocumentsSection";
import { PayrollManager } from "@/components/payroll/PayrollManager";
import { employmentStatusMeta, leaveStatusMeta, payrollStatusMeta } from "@/lib/ui/status";
import type { Role } from "@/lib/db/schema";

export async function EmployeeProfileView({ employeeId, viewerRole }: { employeeId: string; viewerRole: Role }) {
  const start = new Date();
  start.setDate(start.getDate() - 29);

  const [full, departments, timeline, payrollRecords, attendanceSummary, leaveRequests] = await Promise.all([
    getEmployeeWithUser(employeeId),
    listDepartments(),
    getEmployeeTimeline(employeeId, 15),
    viewerRole === "HR" ? getAllPayrollForEmployee(employeeId) : getPublishedPayrollHistory(employeeId),
    getAttendanceSummary(employeeId, start.toISOString().slice(0, 10), todayISO()),
    listLeaveRequestsForEmployee(employeeId),
  ]);

  if (!full) {
    return <Alert tone="danger">Employee not found.</Alert>;
  }

  const { employee, user, department } = full;
  const completeness = profileCompleteness(employee);

  return (
    <div className="space-y-6 df-animate-in">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={employee.fullName} src={employee.profilePhotoUrl} size={56} />
            <div>
              <h1 className="text-xl font-semibold text-[var(--df-text-primary)]">{employee.fullName}</h1>
              <p className="text-sm text-[var(--df-text-muted)]">
                {employee.jobTitle || "Job title not set"} {department ? `· ${department.name}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={employmentStatusMeta[employee.employmentStatus].tone}>{employmentStatusMeta[employee.employmentStatus].label}</Badge>
                {user && <Badge tone="neutral">{user.employeeCode}</Badge>}
                {user?.role === "HR" && <Badge tone="accent">HR</Badge>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-right">
            <InfoRow icon={Mail} value={user?.email} />
            <InfoRow icon={Phone} value={employee.phone} />
            <InfoRow icon={MapPin} value={employee.address} />
            <InfoRow icon={Calendar} value={employee.dateOfJoining ? `Joined ${formatDate(employee.dateOfJoining)}` : null} />
          </div>
        </CardContent>
      </Card>

      {!completeness.complete && <Alert tone="warning">Missing: {completeness.missing.join(", ")}.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat label="Attendance (30d)" value={`${attendanceSummary.attendancePercentage}%`} />
        <MiniStat label="Present days" value={attendanceSummary.present} />
        <MiniStat label="Leave requests" value={leaveRequests.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal &amp; job information</CardTitle>
          <CardDescription>{viewerRole === "HR" ? "HR can edit all fields below." : "You can edit contact details; job information is managed by HR."}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEditForm
            employeeId={employeeId}
            canEditHrFields={viewerRole === "HR"}
            departments={departments}
            initial={{
              fullName: employee.fullName,
              phone: employee.phone,
              address: employee.address,
              emergencyContactName: employee.emergencyContactName,
              emergencyContactPhone: employee.emergencyContactPhone,
              profilePhotoUrl: employee.profilePhotoUrl,
              departmentId: employee.departmentId,
              jobTitle: employee.jobTitle,
              employmentStatus: employee.employmentStatus,
              dateOfJoining: employee.dateOfJoining,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-4" /> Salary structure
          </CardTitle>
          <CardDescription>
            {viewerRole === "HR" ? "All records, including unpublished drafts." : "Only published payslips are shown here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {viewerRole === "HR" ? (
            <PayrollManager employeeId={employeeId} />
          ) : payrollRecords.length === 0 ? (
            <EmptyState title="No payroll records yet" description="HR has not added a salary record for this employee." />
          ) : (
            <div className="space-y-2">
              {payrollRecords.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-[var(--df-radius-md)] border border-[var(--df-border)] px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[var(--df-text-primary)]">{formatMonth(r.effectiveMonth)}</p>
                    <p className="text-xs text-[var(--df-text-muted)]">
                      Basic {formatCurrency(r.basicSalary, r.currency)} · Net {formatCurrency(r.netSalary, r.currency)}
                    </p>
                  </div>
                  <Badge tone={payrollStatusMeta[r.status].tone}>{payrollStatusMeta[r.status].label}</Badge>
                </div>
              ))}
            </div>
          )}
          {viewerRole !== "HR" && (
            <Link href="/payroll" className="mt-3 inline-block text-xs font-medium text-[var(--df-accent)] hover:underline">
              View full payroll →
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave history</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <EmptyState title="No leave requests on file" />
          ) : (
            <ul className="space-y-2">
              {leaveRequests.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-[var(--df-radius-md)] border border-[var(--df-border)] px-4 py-3 text-sm">
                  <span className="text-[var(--df-text-secondary)]">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)} · {r.leaveType}
                  </span>
                  <Badge tone={leaveStatusMeta[r.status].tone}>{leaveStatusMeta[r.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentsSection employeeId={employeeId} canUpload />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Employee timeline
          </CardTitle>
          <CardDescription>An audit trail of actions on this record.</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <EmptyState title="No activity recorded yet" />
          ) : (
            <ol className="space-y-3 border-l border-[var(--df-border)] pl-4">
              {timeline.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-[var(--df-accent)]" />
                  <p className="text-[var(--df-text-primary)]">{describeActivity(e.action)}</p>
                  <p className="text-xs text-[var(--df-text-muted)]">{timeAgo(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: typeof Mail; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-[var(--df-text-secondary)] sm:justify-end">
      <Icon className="size-3.5 text-[var(--df-text-muted)]" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--df-radius-lg)] border border-[var(--df-border)] bg-[var(--df-surface)] p-4">
      <p className="text-xs text-[var(--df-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--df-text-primary)]">{value}</p>
    </div>
  );
}

function describeActivity(action: string): string {
  const map: Record<string, string> = {
    EMPLOYEE_CREATED: "Employee profile created",
    EMPLOYEE_UPDATED: "Employee record updated by HR",
    PROFILE_UPDATED: "Profile updated",
    ATTENDANCE_CHECK_IN: "Checked in",
    ATTENDANCE_CHECK_OUT: "Checked out",
    LEAVE_SUBMITTED: "Leave request submitted",
    LEAVE_APPROVED: "Leave request approved",
    LEAVE_REJECTED: "Leave request rejected",
    PAYROLL_UPDATED: "Payroll record updated",
    PAYROLL_PUBLISHED: "Payslip published",
    DOCUMENT_UPLOADED: "Document uploaded",
  };
  return map[action] || action;
}
