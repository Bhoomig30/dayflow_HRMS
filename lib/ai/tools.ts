import type { AIToolDefinition } from "./provider";
import type { SessionPayload } from "@/lib/auth/session";
import { getAttendanceHistory, getAttendanceSummary } from "@/lib/services/attendance.service";
import { getLeaveBalanceSummary, listLeaveRequestsForEmployee } from "@/lib/services/leave.service";
import { getLatestPublishedPayroll, getPublishedPayrollHistory } from "@/lib/services/payroll.service";
import { getAttendanceTrend, getHrOverview } from "@/lib/services/analytics.service";
import { listAllLeaveRequests } from "@/lib/services/leave.service";
import { detectAnomaliesForWindow } from "@/lib/services/anomaly.service";
import { getRecentActivity } from "@/lib/services/activity.service";
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
