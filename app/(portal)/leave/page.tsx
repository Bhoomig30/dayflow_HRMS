import { requireSessionForPage } from "@/lib/auth/pageGuards";
import { getLeaveBalanceSummary, listLeaveRequestsForEmployee } from "@/lib/services/leave.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableContainer, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { LeaveRequestForm } from "@/components/leave/LeaveRequestForm";
import { formatDate } from "@/lib/ui/format";
import { leaveStatusMeta, leaveTypeMeta } from "@/lib/ui/status";
import { CalendarDays } from "lucide-react";

export default async function LeavePage() {
  const session = await requireSessionForPage();
  const [balances, requests] = await Promise.all([getLeaveBalanceSummary(session.employeeId), listLeaveRequestsForEmployee(session.employeeId)]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 df-animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Leave</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Default allotments shown below are configurable placeholders — see your HR policy for the official figures.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {balances.map((b) => (
          <StatCard
            key={b.leaveType}
            label={leaveTypeMeta[b.leaveType].label}
            value={b.remainingDays === null ? "Unlimited" : `${b.remainingDays} left`}
            icon={CalendarDays}
            hint={b.totalDays !== null ? `${b.usedDays} used · ${b.pendingDays} pending · ${b.totalDays} allotted` : `${b.pendingDays} pending`}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apply for leave</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveRequestForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState title="No leave requests yet" description="Requests you submit will appear here with their status." />
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Dates</Th>
                    <Th>Days</Th>
                    <Th>Status</Th>
                    <Th>HR note</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {requests.map((r) => (
                    <Tr key={r.id}>
                      <Td>{leaveTypeMeta[r.leaveType].label}</Td>
                      <Td>
                        {formatDate(r.startDate)} – {formatDate(r.endDate)}
                      </Td>
                      <Td>{r.workingDays}</Td>
                      <Td>
                        <Badge tone={leaveStatusMeta[r.status].tone}>{leaveStatusMeta[r.status].label}</Badge>
                      </Td>
                      <Td className="text-xs text-[var(--df-text-muted)]">{r.hrComment || "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
