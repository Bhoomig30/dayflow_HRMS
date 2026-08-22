import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, createVerifiedEmployee, signIn, type Session } from "./helpers";

let hr: Session;

beforeAll(async () => {
  hr = await signIn("HR001");
});

describe("payroll", () => {
  it("HR can create a draft payroll record for an employee", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Payroll Subject" });
    const res = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-01", basicSalary: 50000, allowances: 5000, deductions: 1000 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.record.status).toBe("DRAFT");
    expect(body.record.netSalary).toBe(54000);
  });

  it("employee sees no records before anything is published (draft is HR-internal)", async () => {
    const emp = await createVerifiedEmployee({ fullName: "No Payroll Yet" });
    await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-02", basicSalary: 40000 }),
    });
    const meRes = await apiFetch("/api/payroll/me", { cookie: emp.cookie });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.records).toEqual([]);

    const ownRecordsRes = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, { cookie: emp.cookie });
    const ownRecordsBody = await ownRecordsRes.json();
    expect(ownRecordsBody.records.every((r: { status: string }) => r.status === "PUBLISHED")).toBe(true);
  });

  it("employee sees a published record after HR publishes it", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Gets Paid" });
    const createRes = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-03", basicSalary: 60000 }),
    });
    const { record } = await createRes.json();

    const publishRes = await apiFetch(`/api/payroll/${record.id}/publish`, { method: "POST", cookie: hr.cookie });
    expect(publishRes.status).toBe(200);

    const meRes = await apiFetch("/api/payroll/me", { cookie: emp.cookie });
    const meBody = await meRes.json();
    expect(meBody.records.some((r: { id: string }) => r.id === record.id)).toBe(true);
  });

  it("employee cannot read another employee's payroll by substituting the ID", async () => {
    const victim = await createVerifiedEmployee({ fullName: "Payroll Victim" });
    const attacker = await createVerifiedEmployee({ fullName: "Payroll Attacker" });
    await apiFetch(`/api/employees/${victim.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-04", basicSalary: 45000 }),
    });
    const res = await apiFetch(`/api/employees/${victim.employeeId}/payroll`, { cookie: attacker.cookie });
    expect(res.status).toBe(403);
  });

  it("employee cannot create/update payroll (HR-only mutation)", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Cannot Write Payroll" });
    const res = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: emp.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-05", basicSalary: 999999 }),
    });
    expect(res.status).toBe(403);
  });

  it("employee cannot publish payroll (HR-only mutation)", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Cannot Publish" });
    const createRes = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-06", basicSalary: 30000 }),
    });
    const { record } = await createRes.json();
    const res = await apiFetch(`/api/payroll/${record.id}/publish`, { method: "POST", cookie: emp.cookie });
    expect(res.status).toBe(403);
  });

  it("rejects deductions that exceed basic salary plus allowances", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Negative Net" });
    const res = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-07", basicSalary: 1000, deductions: 5000 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a negative basic salary", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Negative Salary" });
    const res = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-08", basicSalary: -100 }),
    });
    expect(res.status).toBe(400);
  });

  it("a published record cannot be edited further", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Locked After Publish" });
    const createRes = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-09", basicSalary: 20000 }),
    });
    const { record } = await createRes.json();
    await apiFetch(`/api/payroll/${record.id}/publish`, { method: "POST", cookie: hr.cookie });

    const editRes = await apiFetch(`/api/employees/${emp.employeeId}/payroll`, {
      method: "POST",
      cookie: hr.cookie,
      body: JSON.stringify({ effectiveMonth: "2027-09", basicSalary: 99999 }),
    });
    expect(editRes.status).toBe(409);
  });
});
