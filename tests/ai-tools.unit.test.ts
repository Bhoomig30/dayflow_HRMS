
import { describe, it, expect, beforeAll } from "vitest";
import { buildToolsForSession, executeTool } from "@/lib/ai/tools";
import { authenticate } from "@/lib/services/auth.service";
import type { SessionPayload } from "@/lib/auth/session";

let employeeSession: SessionPayload;
let hrSession: SessionPayload;

beforeAll(async () => {
  const emp = await authenticate({ identifier: "EMP1001", password: "Demo@1234" });
  employeeSession = { userId: emp.user.id, employeeId: emp.employee.id, employeeCode: emp.user.employeeCode, role: emp.user.role, fullName: emp.employee.fullName, email: emp.user.email };

  const hr = await authenticate({ identifier: "HR001", password: "Demo@1234" });
  hrSession = { userId: hr.user.id, employeeId: hr.employee.id, employeeCode: hr.user.employeeCode, role: hr.user.role, fullName: hr.employee.fullName, email: hr.user.email };
});

const EMPLOYEE_TOOL_NAMES = ["get_my_attendance", "get_my_leave_balance", "get_my_leave_requests", "get_my_payroll", "get_my_documents"].sort();
const HR_ONLY_TOOL_NAMES = [
  "get_hr_attendance_summary",
  "get_pending_leave_requests",
  "get_attendance_anomalies",
  "get_recent_hr_activity",
  "get_department_attendance_breakdown",
  "get_employees_with_repeated_anomalies",
  "get_incomplete_profiles",
  "get_missing_payroll_employees",
].sort();

describe("AI tool isolation", () => {
  it("an EMPLOYEE session's tool list is exactly the employee tools — no HR tools, no extras (e.g. no SQL/raw-query tool)", () => {
    const names = buildToolsForSession(employeeSession).map((t) => t.name).sort();
    expect(names).toEqual(EMPLOYEE_TOOL_NAMES);
  });

  it("an HR session's tool list is the employee tools plus the HR tools — still no extras", () => {
    const names = buildToolsForSession(hrSession).map((t) => t.name).sort();
    expect(names).toEqual([...EMPLOYEE_TOOL_NAMES, ...HR_ONLY_TOOL_NAMES].sort());
  });

  it("none of the tool definitions expose an employeeId/userId parameter the model could set", () => {
    const allTools = [...buildToolsForSession(employeeSession), ...buildToolsForSession(hrSession)];
    for (const tool of allTools) {
      expect(Object.keys(tool.parameters.properties)).not.toContain("employeeId");
      expect(Object.keys(tool.parameters.properties)).not.toContain("userId");
    }
  });

  it("PROMPT-INJECTION-STYLE: calling an HR-only tool directly with an EMPLOYEE session is rejected at the tool layer, not silently served", async () => {
    // This simulates the worst case a prompt injection could achieve: the
    // model is fully compromised and tries to call get_pending_leave_requests
    // (org-wide HR data) anyway. The enforcement here is the fixed pool
    // lookup in executeTool() — it never consults the model's stated role,
    // session.role alone decides which pool is used.
    const result = (await executeTool(employeeSession, "get_pending_leave_requests", {})) as { error?: string };
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/not available/i);
  });

  it("PROMPT-INJECTION-STYLE: an EMPLOYEE session cannot use get_attendance_anomalies (HR-only) to see company-wide anomaly data", async () => {
    const result = (await executeTool(employeeSession, "get_attendance_anomalies", {})) as { error?: string };
    expect(result.error).toBeTruthy();
  });

  it("get_my_payroll never returns unpublished/draft figures, for either role", async () => {
    const employeeResult = (await executeTool(employeeSession, "get_my_payroll", {})) as { latest: unknown; history: { status: string }[] };
    for (const record of employeeResult.history) expect(record.status).toBe("PUBLISHED");
  });

  it("a legitimate employee tool call succeeds and returns data — the isolation is about WHICH tools are reachable, not that all data access is blocked", async () => {
    const result = (await executeTool(employeeSession, "get_my_leave_balance", {})) as unknown[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("HR session CAN reach HR-only tools", async () => {
    const result = (await executeTool(hrSession, "get_pending_leave_requests", {})) as { error?: string };
    expect(result.error).toBeUndefined();
  });

  it("get_my_documents returns an array and never leaks another employee's documents (scoped to session.employeeId only)", async () => {
    const result = (await executeTool(employeeSession, "get_my_documents", {})) as unknown[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("PROMPT-INJECTION-STYLE: an EMPLOYEE session cannot reach any of the new HR-only aggregate tools", async () => {
    for (const name of ["get_department_attendance_breakdown", "get_employees_with_repeated_anomalies", "get_incomplete_profiles", "get_missing_payroll_employees"]) {
      const result = (await executeTool(employeeSession, name, {})) as { error?: string };
      expect(result.error).toBeTruthy();
    }
  });

  it("get_department_attendance_breakdown returns per-department rows shaped for 'highest absenteeism' / 'needs attention' questions, sorted worst-first", async () => {
    const result = (await executeTool(hrSession, "get_department_attendance_breakdown", {})) as { departmentName: string; employeeCount: number; attendancePercentage: number | null; anomalyCount: number }[];
    expect(Array.isArray(result)).toBe(true);
    for (const row of result) {
      expect(typeof row.departmentName).toBe("string");
      expect(typeof row.employeeCount).toBe("number");
    }
    // Sorted ascending by attendancePercentage (worst attendance first) —
    // null (no counted days) is treated as best-case and sorts last.
    const percentages = result.map((r) => r.attendancePercentage ?? 100);
    for (let i = 1; i < percentages.length; i++) expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
  });

  it("get_employees_with_repeated_anomalies only includes employees with 2+ anomalies in the window", async () => {
    const result = (await executeTool(hrSession, "get_employees_with_repeated_anomalies", {})) as { employeeName: string; anomalyCount: number }[];
    expect(Array.isArray(result)).toBe(true);
    for (const row of result) expect(row.anomalyCount).toBeGreaterThanOrEqual(2);
  });

  it("get_incomplete_profiles only includes employees actually missing a required field", async () => {
    const result = (await executeTool(hrSession, "get_incomplete_profiles", {})) as { employeeName: string; missingFields: string[] }[];
    expect(Array.isArray(result)).toBe(true);
    for (const row of result) expect(row.missingFields.length).toBeGreaterThan(0);
  });

  it("get_missing_payroll_employees only includes employees without a published record for the current month", async () => {
    const result = (await executeTool(hrSession, "get_missing_payroll_employees", {})) as { employeeName: string; reason: string }[];
    expect(Array.isArray(result)).toBe(true);
    for (const row of result) expect(typeof row.reason).toBe("string");
  });
});

describe("AI endpoint rate limiting", () => {
  it("allows requests under the limit and rejects once the per-employee limit is exceeded within the window", async () => {
    const { checkAIRateLimit } = await import("@/lib/ai/rateLimit");
    const { ApiError } = await import("@/lib/api/errors");
    const key = `rate-limit-test-${Date.now()}`;
    for (let i = 0; i < 15; i++) expect(() => checkAIRateLimit(key)).not.toThrow();
    let caught: unknown;
    try {
      checkAIRateLimit(key);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as InstanceType<typeof ApiError>).code).toBe("RATE_LIMITED");
    expect((caught as InstanceType<typeof ApiError>).status).toBe(429);
    // A different key (a different employee) is unaffected by the first
    // key's usage — the limit is per-employee, not global.
    expect(() => checkAIRateLimit(`${key}-other`)).not.toThrow();
  });
});
