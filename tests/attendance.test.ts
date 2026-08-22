import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, createVerifiedEmployee, signIn, type Session } from "./helpers";

let fresh: Session;
let sara: Session;

beforeAll(async () => {
  fresh = await createVerifiedEmployee({ fullName: "Attendance Test Subject" });
  sara = await signIn("EMP1002");
});

describe("attendance", () => {
  it("check-in succeeds for a brand-new employee with no attendance yet", async () => {
    const res = await apiFetch("/api/attendance/check-in", { method: "POST", cookie: fresh.cookie });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attendance.checkInAt).toBeTruthy();
    expect(["PRESENT", "HALF_DAY"]).toContain(body.attendance.status);
  });

  it("a second check-in the same day is rejected as a duplicate", async () => {
    const res = await apiFetch("/api/attendance/check-in", { method: "POST", cookie: fresh.cookie });
    expect(res.status).toBe(409);
  });

  it("check-out succeeds after check-in", async () => {
    const res = await apiFetch("/api/attendance/check-out", { method: "POST", cookie: fresh.cookie });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attendance.checkOutAt).toBeTruthy();
  });

  it("a second check-out the same day is rejected as a duplicate", async () => {
    const res = await apiFetch("/api/attendance/check-out", { method: "POST", cookie: fresh.cookie });
    expect(res.status).toBe(409);
  });

  it("check-out without a prior check-in is rejected", async () => {
    const other = await createVerifiedEmployee({ fullName: "Never Checked In" });
    const res = await apiFetch("/api/attendance/check-out", { method: "POST", cookie: other.cookie });
    expect(res.status).toBe(400);
  });

  it("an employee cannot fetch another employee's attendance via the /me-style history endpoint by ID substitution", async () => {
    const res = await apiFetch(`/api/attendance/employee/${sara.employeeId}`, { cookie: fresh.cookie });
    expect(res.status).toBe(403);
  });

  it("attendance history returns a well-formed history + summary for the caller's own record", async () => {
    const res = await apiFetch("/api/attendance/me", { cookie: fresh.cookie });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.attendancePercentage).toBe("number");
  });
});
