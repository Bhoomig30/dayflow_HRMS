import Link from "next/link";
import { Users, UserCheck, UserX, CalendarClock, ClipboardList, AlertCircle, ArrowRight } from "lucide-react";
import { requireHrForPage } from "@/lib/auth/pageGuards";
import { getHrOverview } from "@/lib/services/analytics.service";
import { getRecentActivity } from "@/lib/services/activity.service";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { timeAgo } from "@/lib/ui/format";

const attentionHref: Record<string, string> = {
  PENDING_LEAVE: "/hr/leave",
  INCOMPLETE_PROFILE: "/hr/employees",
  ATTENDANCE_ANOMALY: "/hr/anomalies",
};

export default async function HrCommandCenterPage() {
  const session = await requireHrForPage();
  const [overview, activity] = await Promise.all([getHrOverview(), getRecentActivity(10)]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 df-animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Command Center</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">
          Welcome back, {session.fullName.split(" ")[0]} · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {overview.isWeekendToday && <Alert tone="info">It&apos;s the weekend — today&apos;s attendance figures will be low by default.</Alert>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total employees" value={overview.totalEmployees} icon={Users} tone="accent" />
        <StatCard label="Present today" value={overview.presentToday} icon={UserCheck} />
        <StatCard label="On leave today" value={overview.onLeaveToday} icon={CalendarClock} />
        <StatCard label="Absent today" value={overview.absentToday} icon={UserX} />
        <StatCard label="Pending leave" value={overview.pendingLeaveRequests} icon={ClipboardList} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="size-4 text-[var(--df-warning)]" /> Needs attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.attentionItems.length === 0 ? (
            <EmptyState title="Nothing needs attention right now" description="Pending leave, incomplete profiles and attendance anomalies will show up here." />
          ) : (
            <ul className="space-y-2">
              {overview.attentionItems.map((item) => (
                <li key={item.type}>
                  <Link
                    href={attentionHref[item.type] || "/hr"}
                    className="flex items-center justify-between rounded-[var(--df-radius-md)] border border-[var(--df-border)] px-4 py-3 text-sm hover:bg-white/[0.03]"
                  >
                    <span className="text-[var(--df-text-primary)]">
                      {item.label} <span className="text-[var(--df-text-muted)]">({item.count})</span>
                    </span>
                    <ArrowRight className="size-4 text-[var(--df-text-muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <EmptyState title="No recent activity" />
          ) : (
            <ul className="space-y-2.5">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--df-text-secondary)]">{describe(e.action)}</span>
                  <span className="shrink-0 text-xs text-[var(--df-text-muted)]">{timeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function describe(action: string): string {
  const map: Record<string, string> = {
    EMPLOYEE_CREATED: "New employee account created",
    EMPLOYEE_UPDATED: "Employee record updated",
    PROFILE_UPDATED: "An employee updated their profile",
    ATTENDANCE_CHECK_IN: "Check-in recorded",
    ATTENDANCE_CHECK_OUT: "Check-out recorded",
    LEAVE_SUBMITTED: "Leave request submitted",
    LEAVE_APPROVED: "Leave request approved",
    LEAVE_REJECTED: "Leave request rejected",
    PAYROLL_UPDATED: "Payroll record updated",
    PAYROLL_PUBLISHED: "Payslip published",
    DOCUMENT_UPLOADED: "Document uploaded",
  };
  return map[action] || action;
}
