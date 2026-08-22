import Link from "next/link";
import { CalendarDays, Wallet, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { requireSessionForPage } from "@/lib/auth/pageGuards";
import { getAttendanceForDate, getAttendanceSummary } from "@/lib/services/attendance.service";
import { getLeaveBalanceSummary } from "@/lib/services/leave.service";
import { getLatestPublishedPayroll } from "@/lib/services/payroll.service";
import { listNotifications } from "@/lib/services/notification.service";
import { getEmployeeTimeline } from "@/lib/services/activity.service";
import { getEmployeeById, profileCompleteness } from "@/lib/services/employee.service";
import { todayISO } from "@/lib/utils/date";
import { formatCurrency, formatMonth, timeAgo } from "@/lib/ui/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckInOutCard } from "@/components/attendance/CheckInOutCard";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function EmployeeDashboardPage() {
  const session = await requireSessionForPage();
  const today = todayISO();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const startISO = start.toISOString().slice(0, 10);

  const [todayAttendance, summary, balances, payroll, notifications, timeline, employee] = await Promise.all([
    getAttendanceForDate(session.employeeId, today),
    getAttendanceSummary(session.employeeId, startISO, today),
    getLeaveBalanceSummary(session.employeeId),
    getLatestPublishedPayroll(session.employeeId),
    listNotifications(session.employeeId, 5),
    getEmployeeTimeline(session.employeeId, 5),
    getEmployeeById(session.employeeId),
  ]);

  const completeness = employee ? profileCompleteness(employee) : { complete: true, missing: [] };
  const paidBalance = balances.find((b) => b.leaveType === "PAID");

  return (
    <div className="mx-auto max-w-6xl space-y-6 df-animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">
          {greeting()}, {session.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {!completeness.complete && (
        <Alert tone="warning">
          Your profile is missing {completeness.missing.join(", ")}.{" "}
          <Link href="/profile" className="font-medium underline">
            Complete it now
          </Link>
          .
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CheckInOutCard today={todayAttendance ? { status: todayAttendance.status, checkInAt: todayAttendance.checkInAt, checkOutAt: todayAttendance.checkOutAt } : null} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance — last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Present", value: summary.present },
              { label: "Absent", value: summary.absent },
              { label: "Half-day", value: summary.halfDay },
              { label: "On leave", value: summary.leave },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-semibold text-[var(--df-text-primary)]">{s.value}</p>
                <p className="text-xs text-[var(--df-text-muted)]">{s.label}</p>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-4 mt-1 border-t border-[var(--df-border)] pt-3 text-xs text-[var(--df-text-muted)]">
              Attendance rate: <span className="font-medium text-[var(--df-text-primary)]">{summary.attendancePercentage}%</span>
              {summary.daysWithCompleteHours > 0 && (
                <>
                  {" "}
                  · {summary.totalHoursLogged}h logged across {summary.daysWithCompleteHours} day{summary.daysWithCompleteHours === 1 ? "" : "s"}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link href="/leave" className="group">
          <Card className="h-full transition-colors group-hover:bg-[var(--df-surface-hover)]">
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
                  <CalendarDays className="size-4.5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--df-text-primary)]">Leave balance</p>
                <p className="mt-1 text-xs text-[var(--df-text-muted)]">
                  {paidBalance ? `${paidBalance.remainingDays} paid day${paidBalance.remainingDays === 1 ? "" : "s"} remaining` : "View balances"}
                </p>
              </div>
              <ArrowRight className="size-4 text-[var(--df-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/payroll" className="group">
          <Card className="h-full transition-colors group-hover:bg-[var(--df-surface-hover)]">
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
                  <Wallet className="size-4.5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--df-text-primary)]">Payroll</p>
                <p className="mt-1 text-xs text-[var(--df-text-muted)]">
                  {payroll ? `${formatCurrency(payroll.netSalary, payroll.currency)} · ${formatMonth(payroll.effectiveMonth)}` : "No payslip published yet"}
                </p>
              </div>
              <ArrowRight className="size-4 text-[var(--df-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/ai" className="group">
          <Card className="h-full transition-colors group-hover:bg-[var(--df-surface-hover)]">
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
                  <Sparkles className="size-4.5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--df-text-primary)]">Ask Dayflow AI</p>
                <p className="mt-1 text-xs text-[var(--df-text-muted)]">&quot;How many leave days do I have left?&quot;</p>
              </div>
              <ArrowRight className="size-4 text-[var(--df-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <EmptyState icon={AlertCircle} title="No activity yet" description="Actions like leave requests and profile updates will show up here." />
            ) : (
              <ul className="space-y-3">
                {timeline.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-[var(--df-text-secondary)]">{describeActivity(e.action)}</span>
                    <span className="shrink-0 text-xs text-[var(--df-text-muted)]">{timeAgo(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts &amp; notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <EmptyState title="You're all caught up." />
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="font-medium text-[var(--df-text-primary)]">{n.title}</p>
                    <p className="text-xs text-[var(--df-text-muted)]">{n.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function describeActivity(action: string): string {
  const map: Record<string, string> = {
    EMPLOYEE_CREATED: "Your employee profile was created",
    EMPLOYEE_UPDATED: "Your employee record was updated",
    PROFILE_UPDATED: "You updated your profile",
    ATTENDANCE_CHECK_IN: "You checked in",
    ATTENDANCE_CHECK_OUT: "You checked out",
    LEAVE_SUBMITTED: "You submitted a leave request",
    LEAVE_APPROVED: "Your leave request was approved",
    LEAVE_REJECTED: "Your leave request was rejected",
    PAYROLL_UPDATED: "Your payroll record was updated",
    PAYROLL_PUBLISHED: "A new payslip was published",
    DOCUMENT_UPLOADED: "A document was uploaded",
  };
  return map[action] || action;
}
