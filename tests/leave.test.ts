import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, createVerifiedEmployee, signIn, type Session } from "./helpers";

let hr: Session;

beforeAll(async () => {
  hr = await signIn("HR001");
});

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function toWeekday(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 0 || out.getDay() === 6) out.setDate(out.getDate() + 1);
  return out;
}
function futureWeekday(daysAhead: number): string {
  return iso(toWeekday(addDays(new Date(), daysAhead)));
}

describe("leave: submission validation", () => {
  it("submits a valid future leave request", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Leave Submitter" });
    const start = futureWeekday(10);
    const res = await apiFetch("/api/leave", {
      method: "POST",
      cookie: emp.cookie,
      body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: start, remarks: "test" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.request.status).toBe("PENDING");
    expect(body.request.workingDays).toBeGreaterThan(0);
  });

  it("rejects an end date before the start date", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Bad Range" });
    const start = futureWeekday(10);
    const end = futureWeekday(5);
    const res = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: end }) });
    expect(res.status).toBe(400);
  });

  it("rejects a request for a date in the past", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Past Date" });
    const past = iso(addDays(new Date(), -5));
    const res = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: past, endDate: past }) });
    expect(res.status).toBe(400);
  });

  it("rejects an overlapping pending leave request", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Overlapper" });
    const start = futureWeekday(20);
    const first = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: start }) });
    expect(first.status).toBe(201);
    const second = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "SICK", startDate: start, endDate: start }) });
    expect(second.status).toBe(409);
  });

  it("rejects a request that exceeds the remaining balance", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Over Budget" });
    // Default PAID allotment is 18 days; span a wide future range to exceed it.
    const start = futureWeekday(40);
    const end = iso(addDays(new Date(start), 45));
    const res = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: end }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message.toLowerCase()).toContain("insufficient");
  });

  it("does not check a balance for UNPAID leave (no allotment to exceed)", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Unpaid Wide" });
    const start = futureWeekday(40);
    const end = iso(addDays(new Date(start), 45));
    const res = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "UNPAID", startDate: start, endDate: end }) });
    expect(res.status).toBe(201);
  });
});

describe("leave: approval / rejection lifecycle", () => {
  it("HR approves a pending request; balance and attendance stay consistent", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Approval Flow" });
    const start = futureWeekday(11);
    const submitRes = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: start }) });
    const { request } = await submitRes.json();

    const balanceBefore = await (await apiFetch("/api/leave/balance", { cookie: emp.cookie })).json();
    const paidBefore = balanceBefore.balances.find((b: { leaveType: string }) => b.leaveType === "PAID");

    const approveRes = await apiFetch(`/api/leave/${request.id}/approve`, { method: "POST", cookie: hr.cookie, body: JSON.stringify({ comment: "ok" }) });
    expect(approveRes.status).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.request.status).toBe("APPROVED");

    const balanceAfter = await (await apiFetch("/api/leave/balance", { cookie: emp.cookie })).json();
    const paidAfter = balanceAfter.balances.find((b: { leaveType: string }) => b.leaveType === "PAID");
    expect(paidAfter.usedDays).toBe(paidBefore.usedDays + request.workingDays);

    // Attendance sync: the working day(s) in range should now show LEAVE.
    const attRes = await apiFetch(`/api/attendance/employee/${emp.employeeId}?start=${start}&end=${start}`, { cookie: hr.cookie });
    const attBody = await attRes.json();
    const day = attBody.history.find((h: { date: string }) => h.date === start);
    expect(day.status ?? day.effective).toBe("LEAVE");
  });

  it("HR rejects a pending request; no balance change", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Rejection Flow" });
    const start = futureWeekday(12);
    const submitRes = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "SICK", startDate: start, endDate: start }) });
    const { request } = await submitRes.json();

    const rejectRes = await apiFetch(`/api/leave/${request.id}/reject`, { method: "POST", cookie: hr.cookie, body: JSON.stringify({ comment: "not enough notice" }) });
    expect(rejectRes.status).toBe(200);
    const body = await rejectRes.json();
    expect(body.request.status).toBe("REJECTED");

    const balanceAfter = await (await apiFetch("/api/leave/balance", { cookie: emp.cookie })).json();
    const sickAfter = balanceAfter.balances.find((b: { leaveType: string }) => b.leaveType === "SICK");
    expect(sickAfter.usedDays).toBe(0);
  });

  it("a request can transition out of PENDING exactly once — double approval is rejected", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Double Approve" });
    const start = futureWeekday(13);
    const submitRes = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: start }) });
    const { request } = await submitRes.json();

    const first = await apiFetch(`/api/leave/${request.id}/approve`, { method: "POST", cookie: hr.cookie, body: "{}" });
    expect(first.status).toBe(200);
    const second = await apiFetch(`/api/leave/${request.id}/approve`, { method: "POST", cookie: hr.cookie, body: "{}" });
    expect(second.status).toBe(409);
  });

  it("CONCURRENCY: two simultaneous approve requests for the same PENDING request — exactly one succeeds, balance increments exactly once", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Concurrent Approve" });
    const start = futureWeekday(14);
    const submitRes = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "PAID", startDate: start, endDate: start }) });
    const { request } = await submitRes.json();

    const balanceBefore = await (await apiFetch("/api/leave/balance", { cookie: emp.cookie })).json();
    const paidBefore = balanceBefore.balances.find((b: { leaveType: string }) => b.leaveType === "PAID");

    const [r1, r2] = await Promise.all([
      apiFetch(`/api/leave/${request.id}/approve`, { method: "POST", cookie: hr.cookie, body: "{}" }),
      apiFetch(`/api/leave/${request.id}/approve`, { method: "POST", cookie: hr.cookie, body: "{}" }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const balanceAfter = await (await apiFetch("/api/leave/balance", { cookie: emp.cookie })).json();
    const paidAfter = balanceAfter.balances.find((b: { leaveType: string }) => b.leaveType === "PAID");
    // Exactly one increment — not zero (race didn't lose the update) and not
    // double (race didn't apply it twice).
    expect(paidAfter.usedDays).toBe(paidBefore.usedDays + request.workingDays);
  });

  it("CONCURRENCY: approve racing reject on the same request — exactly one wins", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Concurrent Approve Reject" });
    const start = futureWeekday(15);
    const submitRes = await apiFetch("/api/leave", { method: "POST", cookie: emp.cookie, body: JSON.stringify({ leaveType: "SICK", startDate: start, endDate: start }) });
    const { request } = await submitRes.json();

    const [approveRes, rejectRes] = await Promise.all([
      apiFetch(`/api/leave/${request.id}/approve`, { method: "POST", cookie: hr.cookie, body: "{}" }),
      apiFetch(`/api/leave/${request.id}/reject`, { method: "POST", cookie: hr.cookie, body: "{}" }),
    ]);
    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalRes = await apiFetch("/api/leave", { cookie: emp.cookie });
    const finalBody = await finalRes.json();
    const finalReq = finalBody.requests.find((r: { id: string }) => r.id === request.id);
    expect(["APPROVED", "REJECTED"]).toContain(finalReq.status);
  });
});
