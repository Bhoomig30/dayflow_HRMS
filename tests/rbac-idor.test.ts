import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, signIn, createVerifiedEmployee, type Session } from "./helpers";

let aditya: Session; // EMP1001, seeded
let sara: Session; // EMP1002, seeded
let hr: Session; // HR001, seeded

beforeAll(async () => {
  aditya = await signIn("EMP1001");
  sara = await signIn("EMP1002");
  hr = await signIn("HR001");
});

describe("RBAC: employee vs HR-only endpoints", () => {
  it("employee cannot list all employees (HR-only)", async () => {
    const res = await apiFetch("/api/employees", { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee cannot create an employee (HR-only)", async () => {
    const res = await apiFetch("/api/employees", {
      method: "POST",
      cookie: aditya.cookie,
      body: JSON.stringify({ fullName: "x", employeeCode: "ZZZ1", email: "zzz1@dayflow.test", password: "TestPass1" }),
    });
    expect(res.status).toBe(403);
  });

  it("employee cannot view company-wide anomalies (HR-only)", async () => {
    const res = await apiFetch("/api/anomalies", { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee cannot view HR analytics (HR-only)", async () => {
    const res = await apiFetch("/api/analytics", { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee cannot view all leave requests (HR-only)", async () => {
    const res = await apiFetch("/api/leave/all", { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee cannot approve a leave request (HR-only)", async () => {
    const res = await apiFetch("/api/leave/some-id/approve", { method: "POST", cookie: aditya.cookie, body: "{}" });
    expect(res.status).toBe(403);
  });

  it("HR can access HR-only endpoints", async () => {
    const res = await apiFetch("/api/employees", { cookie: hr.cookie });
    expect(res.status).toBe(200);
    const analyticsRes = await apiFetch("/api/analytics", { cookie: hr.cookie });
    expect(analyticsRes.status).toBe(200);
  });
});

describe("IDOR: employee A vs employee B's resources", () => {
  it("employee A cannot read employee B's profile", async () => {
    const res = await apiFetch(`/api/employees/${sara.employeeId}`, { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee A cannot edit employee B's profile", async () => {
    const res = await apiFetch(`/api/employees/${sara.employeeId}`, { method: "PATCH", cookie: aditya.cookie, body: JSON.stringify({ phone: "0000000000" }) });
    expect(res.status).toBe(403);
  });

  it("employee A cannot read employee B's attendance", async () => {
    const res = await apiFetch(`/api/attendance/employee/${sara.employeeId}`, { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee A cannot read employee B's payroll", async () => {
    const res = await apiFetch(`/api/employees/${sara.employeeId}/payroll`, { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee A cannot read employee B's documents list", async () => {
    const res = await apiFetch(`/api/employees/${sara.employeeId}/documents`, { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee A cannot upload a document for employee B", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }), "x.pdf");
    const res = await apiFetch(`/api/employees/${sara.employeeId}/documents`, { method: "POST", cookie: aditya.cookie, body: form as unknown as BodyInit, headers: {} });
    expect(res.status).toBe(403);
  });

  it("employee A cannot read employee B's timeline", async () => {
    const res = await apiFetch(`/api/employees/${sara.employeeId}/timeline`, { cookie: aditya.cookie });
    expect(res.status).toBe(403);
  });

  it("employee can read their own profile/attendance/payroll/timeline", async () => {
    const results = await Promise.all([
      apiFetch(`/api/employees/${aditya.employeeId}`, { cookie: aditya.cookie }),
      apiFetch(`/api/attendance/employee/${aditya.employeeId}`, { cookie: aditya.cookie }),
      apiFetch(`/api/employees/${aditya.employeeId}/payroll`, { cookie: aditya.cookie }),
      apiFetch(`/api/employees/${aditya.employeeId}/timeline`, { cookie: aditya.cookie }),
    ]);
    for (const res of results) expect(res.status).toBe(200);
  });

  it("HR can read any employee's profile/attendance/payroll", async () => {
    const results = await Promise.all([
      apiFetch(`/api/employees/${aditya.employeeId}`, { cookie: hr.cookie }),
      apiFetch(`/api/attendance/employee/${aditya.employeeId}`, { cookie: hr.cookie }),
      apiFetch(`/api/employees/${aditya.employeeId}/payroll`, { cookie: hr.cookie }),
    ]);
    for (const res of results) expect(res.status).toBe(200);
  });

  it("notifications: an employee cannot mark another employee's notification as read by guessing its ID", async () => {
    // Create a notification for Aditya by submitting a leave request as Aditya, then try to mark it read as Sara.
    const start = futureWeekday();
    const submitRes = await apiFetch("/api/leave", {
      method: "POST",
      cookie: aditya.cookie,
      body: JSON.stringify({ leaveType: "UNPAID", startDate: start, endDate: start, remarks: "notif idor test" }),
    });
    expect(submitRes.status).toBe(201);
    const notifsRes = await apiFetch("/api/notifications", { cookie: aditya.cookie });
    const notifs = (await notifsRes.json()).notifications;
    expect(notifs.length).toBeGreaterThan(0);
    const notifId = notifs[0].id;

    // Sara attempts to mark Aditya's notification read.
    const crossRes = await apiFetch(`/api/notifications/${notifId}/read`, { method: "POST", cookie: sara.cookie });
    expect(crossRes.status).toBe(200); // the route itself doesn't 403 (it's a no-op scoped update)

    // Verify it is still unread from Aditya's perspective — Sara's request must not have touched it.
    const afterRes = await apiFetch("/api/notifications", { cookie: aditya.cookie });
    const after = (await afterRes.json()).notifications.find((n: { id: string }) => n.id === notifId);
    expect(after.isRead).toBe(false);
  });
});

describe("Role escalation", () => {
  it("an employee cannot set role/baseSalary/protected fields on their own profile — they are silently stripped, not applied", async () => {
    const res = await apiFetch(`/api/employees/${aditya.employeeId}`, {
      method: "PATCH",
      cookie: aditya.cookie,
      body: JSON.stringify({ phone: "1234567890", role: "HR", employmentStatus: "INACTIVE", departmentId: "dept_fake" }),
    });
    expect(res.status).toBe(200);
    const meRes = await apiFetch("/api/auth/session", { cookie: aditya.cookie });
    const me = await meRes.json();
    expect(me.user.role).toBe("EMPLOYEE");
  });

  it("HR creating another HR account is allowed (intentional, gated server-side to the HR role)", async () => {
    const code = `HRX${Date.now().toString(36).toUpperCase()}`;
    const res = await apiFetch("/api/employees", {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ fullName: "New HR", employeeCode: code, email: `${code.toLowerCase()}@dayflow.test`, password: "TestPass1", role: "HR" }),
    });
    expect(res.status).toBe(201);
    // HR-created accounts are pre-verified (documented assumption — see auth.service.ts) so they can sign in immediately.
    const newHrSession = await signIn(code, "TestPass1");
    expect(newHrSession.role).toBe("HR");
  });
});

describe("Stale/deactivated session", () => {
  it("a session issued before deactivation stops working immediately after HR deactivates the employee", async () => {
    const victim = await createVerifiedEmployee({ fullName: "Soon Deactivated" });
    // Confirm the session works before deactivation.
    const before = await apiFetch("/api/notifications", { cookie: victim.cookie });
    expect(before.status).toBe(200);

    const deactivateRes = await apiFetch(`/api/employees/${victim.employeeId}`, {
      method: "PATCH",
      cookie: hr.cookie,
      body: JSON.stringify({ employmentStatus: "INACTIVE" }),
    });
    expect(deactivateRes.status).toBe(200);

    // The OLD cookie/JWT is untouched — same token as before — but the
    // account is now inactive, so the request must be rejected.
    const after = await apiFetch("/api/notifications", { cookie: victim.cookie });
    expect(after.status).toBe(401);

    // And a fresh sign-in attempt with the same credentials is also rejected.
    const signInRes = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier: victim.employeeCode, password: victim.password }) });
    expect(signInRes.status).toBe(401);
  });
});

function futureWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
