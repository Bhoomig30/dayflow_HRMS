import { requireHrForPage } from "@/lib/auth/pageGuards";
import { getAttendanceForAllOnDate } from "@/lib/services/attendance.service";
import { listEmployees } from "@/lib/services/employee.service";
import { todayISO } from "@/lib/utils/date";
import { formatTime } from "@/lib/ui/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableContainer, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { attendanceStatusMeta } from "@/lib/ui/status";
import { Avatar } from "@/components/ui/Avatar";

export default async function HrAttendancePage() {
  await requireHrForPage();
  const today = todayISO();
  const [records, employees] = await Promise.all([getAttendanceForAllOnDate(today), listEmployees()]);
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

  const rows = employees
    .map(({ employee, department }) => ({
      employeeId: employee.id,
      fullName: employee.fullName,
      photo: employee.profilePhotoUrl,
      department: department?.name ?? "—",
      attendance: byEmployee.get(employee.id) ?? null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="mx-auto max-w-5xl space-y-6 df-animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Today&apos;s attendance</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company-wide snapshot</CardTitle>
          <CardDescription>{rows.length} active employee{rows.length === 1 ? "" : "s"}.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No employees yet" />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <TableContainer>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Employee</Th>
                        <Th>Department</Th>
                        <Th>Status</Th>
                        <Th>Check-in</Th>
                        <Th>Check-out</Th>
                      </Tr>
                    </Thead>
                    <tbody>
                      {rows.map((r) => (
                        <Tr key={r.employeeId}>
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={r.fullName} src={r.photo} size={28} />
                              {r.fullName}
                            </div>
                          </Td>
                          <Td className="text-[var(--df-text-secondary)]">{r.department}</Td>
                          <Td>
                            {r.attendance ? (
                              <Badge tone={attendanceStatusMeta[r.attendance.status].tone}>{attendanceStatusMeta[r.attendance.status].label}</Badge>
                            ) : (
                              <Badge tone="neutral">Not checked in</Badge>
                            )}
                          </Td>
                          <Td>{formatTime(r.attendance?.checkInAt)}</Td>
                          <Td>{formatTime(r.attendance?.checkOutAt)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableContainer>
              </div>

              {/* Mobile card list */}
              <ul className="space-y-2 md:hidden">
                {rows.map((r) => (
                  <li key={r.employeeId} className="rounded-[var(--df-radius-md)] border border-[var(--df-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.fullName} src={r.photo} size={30} />
                        <div>
                          <p className="text-sm font-medium text-[var(--df-text-primary)]">{r.fullName}</p>
                          <p className="text-xs text-[var(--df-text-muted)]">{r.department}</p>
                        </div>
                      </div>
                      {r.attendance ? (
                        <Badge tone={attendanceStatusMeta[r.attendance.status].tone}>{attendanceStatusMeta[r.attendance.status].label}</Badge>
                      ) : (
                        <Badge tone="neutral">Not checked in</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-[var(--df-text-muted)]">
                      <span>In: {formatTime(r.attendance?.checkInAt)}</span>
                      <span>Out: {formatTime(r.attendance?.checkOutAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
