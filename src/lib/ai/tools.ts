import type { AIToolDefinition } from "./provider";
import type { SessionPayload } from "@/lib/auth/session";
import { getAttendanceHistory, getAttendanceInRangeAllEmployees, getAttendanceSummary } from "@/lib/services/attendance.service";
import { getLeaveBalanceSummary, listLeaveRequestsForEmployee } from "@/lib/services/leave.service";
import { getAllPayrollForEmployee, getLatestPublishedPayroll, getPublishedPayrollHistory } from "@/lib/services/payroll.service";
import { getAttendanceTrend, getHrOverview } from "@/lib/services/analytics.service";
import { listAllLeaveRequests } from "@/lib/services/leave.service";
import { detectAnomaliesForWindow } from "@/lib/services/anomaly.service";
import { getRecentActivity } from "@/lib/services/activity.service";
import { listDocumentsForEmployee } from "@/lib/services/document.service";
import { listDepartments, listEmployees, profileCompleteness } from "@/lib/services/employee.service";
import { todayISO } from "@/lib/utils/date";

/**
 * CONTROLLED TOOL LAYER
 * ---------------------
 * Every tool below is a plain function of (session, args). None of them
 * accept an employeeId/userId argument from the model — the acting
 * employee is always read from the verified server-side session
 * (SessionPayload), never from anything the AI or client supplied. This is
 * the actual enforcement point; the model is never trusted to "decide" not
 * to look at someone else's data.
 *
 * HR-only tools are simply not included in the tool list handed to the
 * provider for an EMPLOYEE session (see buildToolsForSession), so an
 * employee session cannot invoke them even if it tried — there is no code
 * path where an EMPLOYEE session reaches an HR executor.
 */

type ToolExecutor = (session: SessionPayload, args: Record<string, unknown>) => Promise<unknown>;

const employeeTools: Record<string, { def: AIToolDefinition; run: ToolExecutor }> = {
  get_my_attendance: {
    def: {
      name: "get_my_attendance",
      description: "Get the current user's attendance history and summary for the last N days (default 30).",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "How many days back to look, 1-90." } },
      },
    },
    run: async (session, args) => {
      const days = clampDays(args.days, 30);
      const end = todayISO();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startISO = start.toISOString().slice(0, 10);
      const [summary, history] = await Promise.all([
        getAttendanceSummary(session.employeeId, startISO, end),
        getAttendanceHistory(session.employeeId, startISO, end),
      ]);
      return { summary, recentDays: history.slice(-14) };
    },
  },
  get_my_leave_balance: {
    def: {
      name: "get_my_leave_balance",
      description: "Get the current user's leave balances (Paid, Sick, Unpaid) including used, pending and remaining days.",
      parameters: { type: "object", properties: {} },
    },
    run: async (session) => getLeaveBalanceSummary(session.employeeId),
  },
  get_my_leave_requests: {
    def: {
      name: "get_my_leave_requests",
      description: "Get the current user's leave requests and their statuses (pending/approved/rejected).",
      parameters: { type: "object", properties: {} },
    },
    run: async (session) => listLeaveRequestsForEmployee(session.employeeId),
  },
  get_my_payroll: {
    def: {
      name: "get_my_payroll",
      description: "Get the current user's most recent published payroll record and recent payslip history. Never returns unpublished/draft figures.",
      parameters: { type: "object", properties: {} },
    },
    run: async (session) => {
      const [latest, history] = await Promise.all([
        getLatestPublishedPayroll(session.employeeId),
        getPublishedPayrollHistory(session.employeeId),
      ]);
      return { latest, history: history.slice(0, 6) };
    },
  },
  get_my_documents: {
    def: {
      name: "get_my_documents",
      description: "List the documents currently on file for the current user (name, type, upload date). Does not return file contents.",
      parameters: { type: "object", properties: {} },
    },
    run: async (session) => {
      const docs = await listDocumentsForEmployee(session.employeeId);
      return docs.map((d) => ({ id: d.id, name: d.name, fileType: d.fileType, uploadedAt: d.createdAt }));
    },
  },
};

const hrTools: Record<string, { def: AIToolDefinition; run: ToolExecutor }> = {
  get_hr_attendance_summary: {
    def: {
      name: "get_hr_attendance_summary",
      description: "Get today's org-wide attendance snapshot (present/absent/leave/half-day counts) and a recent attendance trend.",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const [overview, trend] = await Promise.all([getHrOverview(), getAttendanceTrend(14)]);
      return { overview, trend };
    },
  },
  get_pending_leave_requests: {
    def: {
      name: "get_pending_leave_requests",
      description: "List all leave requests currently awaiting HR review, with employee name, type and dates.",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const rows = await listAllLeaveRequests("PENDING");
      return rows.map((r) => ({
        id: r.request.id,
        employeeName: r.employee.fullName,
        leaveType: r.request.leaveType,
        startDate: r.request.startDate,
        endDate: r.request.endDate,
        workingDays: r.request.workingDays,
        submittedAt: r.request.createdAt,
      }));
    },
  },
  get_attendance_anomalies: {
    def: {
      name: "get_attendance_anomalies",
      description: "List explainable attendance anomalies (repeated lateness, missing checkouts, unusually long days) detected in the last 30 days.",
      parameters: { type: "object", properties: {} },
    },
    run: async () => detectAnomaliesForWindow(30),
  },
  get_recent_hr_activity: {
    def: {
      name: "get_recent_hr_activity",
      description: "Get a feed of recent HR-relevant activity/audit events across the company (leave decisions, profile updates, payroll changes).",
      parameters: { type: "object", properties: {} },
    },
    run: async () => getRecentActivity(20),
  },
  get_department_attendance_breakdown: {
    def: {
      name: "get_department_attendance_breakdown",
      description:
        "Get attendance and anomaly counts broken down by department for the last 30 days, sorted worst-attendance-first. Use this to answer questions about which department has the highest absenteeism or which departments need attention.",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const [employeeRows, departmentRows, anomalies] = await Promise.all([
        listEmployees(),
        listDepartments(),
        detectAnomaliesForWindow(30),
      ]);

      const end = todayISO();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startISO = start.toISOString().slice(0, 10);
      const attendanceRows = await getAttendanceInRangeAllEmployees(startISO, end);

      const deptNameById = new Map(departmentRows.map((d) => [d.id, d.name]));
      const deptByEmployeeId = new Map(employeeRows.map((r) => [r.employee.id, r.employee.departmentId]));

      interface Bucket {
        departmentName: string;
        employeeCount: number;
        present: number;
        absent: number;
        halfDay: number;
        leave: number;
        anomalyCount: number;
      }
      const buckets = new Map<string, Bucket>();
      const bucketFor = (departmentId: string | null) => {
        const key = departmentId ?? "unassigned";
        const name = departmentId ? deptNameById.get(departmentId) ?? "Unknown department" : "No department assigned";
        if (!buckets.has(key)) buckets.set(key, { departmentName: name, employeeCount: 0, present: 0, absent: 0, halfDay: 0, leave: 0, anomalyCount: 0 });
        return buckets.get(key)!;
      };

      for (const r of employeeRows) bucketFor(r.employee.departmentId).employeeCount++;
      for (const row of attendanceRows) {
        const deptId = deptByEmployeeId.get(row.employeeId);
        if (deptId === undefined) continue; // attendance row for an employee not in the active roster
        const bucket = bucketFor(deptId ?? null);
        if (row.status === "PRESENT") bucket.present++;
        else if (row.status === "ABSENT") bucket.absent++;
        else if (row.status === "HALF_DAY") bucket.halfDay++;
        else if (row.status === "LEAVE") bucket.leave++;
      }
      for (const a of anomalies) {
        const deptId = deptByEmployeeId.get(a.employeeId);
        if (deptId === undefined) continue;
        bucketFor(deptId ?? null).anomalyCount++;
      }

      const results = Array.from(buckets.values()).map((b) => {
        const counted = b.present + b.absent + b.halfDay + b.leave;
        const attendancePercentage = counted > 0 ? Math.round(((b.present + b.halfDay * 0.5 + b.leave) / counted) * 1000) / 10 : null;
        return {
          departmentName: b.departmentName,
          employeeCount: b.employeeCount,
          attendancePercentage,
          absentDays: b.absent,
          anomalyCount: b.anomalyCount,
        };
      });
      results.sort((a, b) => (a.attendancePercentage ?? 100) - (b.attendancePercentage ?? 100));
      return results;
    },
  },
  get_employees_with_repeated_anomalies: {
    def: {
      name: "get_employees_with_repeated_anomalies",
      description: "List employees who have 2 or more attendance anomalies (repeated lateness, missing checkouts, long hours, frequent half-days) in the last 30 days.",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const anomalies = await detectAnomaliesForWindow(30);
      const byEmployee = new Map<string, { employeeName: string; anomalyCount: number; types: Set<string> }>();
      for (const a of anomalies) {
        const entry = byEmployee.get(a.employeeId) ?? { employeeName: a.employeeName, anomalyCount: 0, types: new Set<string>() };
        entry.anomalyCount++;
        entry.types.add(a.type);
        byEmployee.set(a.employeeId, entry);
      }
      return Array.from(byEmployee.values())
        .filter((e) => e.anomalyCount >= 2)
        .map((e) => ({ employeeName: e.employeeName, anomalyCount: e.anomalyCount, anomalyTypes: Array.from(e.types) }))
        .sort((a, b) => b.anomalyCount - a.anomalyCount);
    },
  },
  get_incomplete_profiles: {
    def: {
      name: "get_incomplete_profiles",
      description: "List active employees whose profile is missing required information (phone, address, emergency contact, department, or job title).",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const employeeRows = await listEmployees();
      return employeeRows
        .map((r) => ({ employeeName: r.employee.fullName, ...profileCompleteness(r.employee) }))
        .filter((r) => !r.complete)
        .map((r) => ({ employeeName: r.employeeName, missingFields: r.missing }));
    },
  },
  get_missing_payroll_employees: {
    def: {
      name: "get_missing_payroll_employees",
      description: "List active employees who do not have a published payroll record for the current month (either no record at all, or a draft that was never published).",
      parameters: { type: "object", properties: {} },
    },
    run: async () => {
      const employeeRows = await listEmployees();
      const currentMonth = todayISO().slice(0, 7); // YYYY-MM
      const results: { employeeName: string; reason: string }[] = [];
      for (const r of employeeRows) {
        const records = await getAllPayrollForEmployee(r.employee.id);
        const thisMonth = records.find((rec) => rec.effectiveMonth === currentMonth);
        if (!thisMonth) results.push({ employeeName: r.employee.fullName, reason: `No payroll record for ${currentMonth}` });
        else if (thisMonth.status !== "PUBLISHED") results.push({ employeeName: r.employee.fullName, reason: `${currentMonth} record exists but is still a draft (not published)` });
      }
      return results;
    },
  },
};

function clampDays(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : fallback;
  return Math.min(90, Math.max(1, Math.round(n) || fallback));
}

export function buildToolsForSession(session: SessionPayload): AIToolDefinition[] {
  const pool = session.role === "HR" ? { ...employeeTools, ...hrTools } : employeeTools;
  return Object.values(pool).map((t) => t.def);
}

export async function executeTool(session: SessionPayload, name: string, args: Record<string, unknown>): Promise<unknown> {
  const pool = session.role === "HR" ? { ...employeeTools, ...hrTools } : employeeTools;
  const tool = pool[name];
  if (!tool) {
    return { error: `Tool "${name}" is not available for your role.` };
  }
  return tool.run(session, args);
}