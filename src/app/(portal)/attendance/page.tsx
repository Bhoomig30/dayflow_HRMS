import { requireSessionForPage } from "@/lib/auth/pageGuards";
import { getAttendanceHistory, getAttendanceSummary } from "@/lib/services/attendance.service";
import { todayISO } from "@/lib/utils/date";
import { formatDate, formatTime } from "@/lib/ui/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableContainer, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { AttendanceHeatmap } from "@/components/attendance/AttendanceHeatmap";
import { attendanceStatusMeta } from "@/lib/ui/status";
import { CalendarCheck, CalendarX, Clock, TrendingUp } from "lucide-react";

export default async function AttendancePage() {
  const session = await requireSessionForPage();
  const end = todayISO();
  const start = new Date();
  start.setDate(start.getDate() - 89);
  const startISO = start.toISOString().slice(0, 10);

  const [history, summary] = await Promise.all([
    getAttendanceHistory(session.employeeId, startISO, end),
    getAttendanceSummary(session.employeeId, startISO, end),
  ]);

  const recent = [...history].filter((d) => !d.isWeekend).reverse().slice(0, 30);

  return (
    <div className="mx-auto max-w-5xl space-y-6 df-animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Attendance</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">Last 90 days.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Attendance rate" value={`${summary.attendancePercentage}%`} icon={TrendingUp} tone="accent" />
        <StatCard label="Present" value={summary.present} icon={CalendarCheck} />
        <StatCard label="Absent" value={summary.absent} icon={CalendarX} />
        <StatCard label="Hours logged" value={summary.totalHoursLogged} icon={Clock} hint={`Across ${summary.daysWithCompleteHours} day(s) with a checkout`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar heatmap</CardTitle>
          <CardDescription>Each column is a work week (Mon–Fri).</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap history={history} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState title="No attendance records available." />
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th>Check-in</Th>
                    <Th>Check-out</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {recent.map((d) => (
                    <Tr key={d.date}>
                      <Td>{formatDate(d.date)}</Td>
                      <Td>
                        {d.effective ? (
                          <Badge tone={attendanceStatusMeta[d.effective].tone}>{attendanceStatusMeta[d.effective].label}</Badge>
                        ) : (
                          <span className="text-xs text-[var(--df-text-muted)]">No data</span>
                        )}
                      </Td>
                      <Td>{formatTime(d.checkInAt)}</Td>
                      <Td>{formatTime(d.checkOutAt)}</Td>
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
