import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, createVerifiedEmployee, signIn, type Session } from "./helpers";

let hr: Session;

beforeAll(async () => {
  hr = await signIn("HR001");
});

function pdfBlob(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

describe("documents", () => {
  it("owner can upload and then list their own document", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Doc Owner" });
    const form = new FormData();
    form.append("file", pdfBlob(1024), "resume.pdf");
    const uploadRes = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { method: "POST", cookie: emp.cookie, body: form });
    expect(uploadRes.status).toBe(201);

    const listRes = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { cookie: emp.cookie });
    const listBody = await listRes.json();
    expect(listBody.documents.length).toBe(1);
  });

  it("rejects an unsupported file type", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Bad File Type" });
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "application/x-msdownload" }), "virus.exe");
    const res = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { method: "POST", cookie: emp.cookie, body: form });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized file", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Too Big" });
    const form = new FormData();
    form.append("file", pdfBlob(6 * 1024 * 1024), "big.pdf"); // default cap is 5MB
    const res = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { method: "POST", cookie: emp.cookie, body: form });
    expect(res.status).toBe(400);
  });

  it("rejects an upload with no file field", async () => {
    const emp = await createVerifiedEmployee({ fullName: "No File" });
    const form = new FormData();
    form.append("notAFile", "hello");
    const res = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { method: "POST", cookie: emp.cookie, body: form });
    expect(res.status).toBe(400);
  });

  it("owner can download their own uploaded document", async () => {
    const emp = await createVerifiedEmployee({ fullName: "Downloader" });
    const form = new FormData();
    form.append("file", pdfBlob(512), "id-card.pdf");
    await apiFetch(`/api/employees/${emp.employeeId}/documents`, { method: "POST", cookie: emp.cookie, body: form });
    const listRes = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { cookie: emp.cookie });
    const { documents } = await listRes.json();

    const downloadRes = await apiFetch(`/api/documents/${documents[0].id}/download`, { cookie: emp.cookie });
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");
  });

  it("another employee cannot download a document by changing the document ID (IDOR)", async () => {
    const owner = await createVerifiedEmployee({ fullName: "Doc Owner 2" });
    const attacker = await createVerifiedEmployee({ fullName: "Doc Attacker" });
    const form = new FormData();
    form.append("file", pdfBlob(512), "private.pdf");
    await apiFetch(`/api/employees/${owner.employeeId}/documents`, { method: "POST", cookie: owner.cookie, body: form });
    const listRes = await apiFetch(`/api/employees/${owner.employeeId}/documents`, { cookie: owner.cookie });
    const { documents } = await listRes.json();

    const res = await apiFetch(`/api/documents/${documents[0].id}/download`, { cookie: attacker.cookie });
    expect(res.status).toBe(403);
  });

  it("HR can access any employee's documents", async () => {
    const emp = await createVerifiedEmployee({ fullName: "HR Can See" });
    const form = new FormData();
    form.append("file", pdfBlob(256), "note.pdf");
    await apiFetch(`/api/employees/${emp.employeeId}/documents`, { method: "POST", cookie: emp.cookie, body: form });
    const res = await apiFetch(`/api/employees/${emp.employeeId}/documents`, { cookie: hr.cookie });
    expect(res.status).toBe(200);
  });

  it("path traversal via a crafted employeeId segment is rejected, not written outside the storage directory", async () => {
    const form = new FormData();
    form.append("file", pdfBlob(64), "evil.pdf");
    // HR bypasses the ownership-equality check (role===HR short-circuits
    // requireOwnerOrHr), so this specifically exercises the employee-must-
    // actually-exist + path-containment defense in document.service.ts,
    // not the auth guard.
    const res = await apiFetch(`/api/employees/${encodeURIComponent("../../../../tmp/dayflow-traversal-test")}/documents`, {
      method: "POST",
      cookie: hr.cookie,
      body: form,
    });
    expect([400, 404]).toContain(res.status);
  });

  it("a nonexistent document ID returns 404, not a stack trace or file error", async () => {
    const emp = await createVerifiedEmployee({ fullName: "404 Doc" });
    const res = await apiFetch(`/api/documents/doc_does_not_exist/download`, { cookie: emp.cookie });
    expect(res.status).toBe(404);
  });
});
