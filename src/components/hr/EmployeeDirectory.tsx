"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { useApi } from "@/lib/client/useApi";
import { api, ClientApiError } from "@/lib/client/api";
import { employmentStatusMeta } from "@/lib/ui/status";

interface EmployeeRow {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  role: string;
  department: string | null;
  jobTitle: string | null;
  employmentStatus: "ACTIVE" | "INACTIVE";
  profileComplete: boolean;
}

const emptyForm = { fullName: "", employeeCode: "", email: "", password: "", department: "", jobTitle: "", role: "EMPLOYEE" as "EMPLOYEE" | "HR" };

export function EmployeeDirectory() {
  const { data, error, loading, refetch } = useApi<{ employees: EmployeeRow[] }>("/api/employees");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.employees;
    return data.employees.filter((e) => [e.fullName, e.employeeCode, e.email, e.department, e.jobTitle].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }, [data, query]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post("/api/employees", form);
      setModalOpen(false);
      setForm(emptyForm);
      refetch();
    } catch (err) {
      setFormError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Employees</CardTitle>
          <CardDescription>{data ? `${data.employees.length} total` : "Loading…"}</CardDescription>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <UserPlus className="size-4" /> Add employee
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--df-text-muted)]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID, department…" className="pl-9" />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {loading && <p className="text-xs text-[var(--df-text-muted)]">Loading…</p>}
        {!loading && filtered.length === 0 && <EmptyState title="No employees found" />}

        {!loading && filtered.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Employee ID</Th>
                  <Th>Department</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Profile</Th>
                </Tr>
              </Thead>
              <tbody>
                {filtered.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <Link href={`/hr/employees/${e.id}`} className="font-medium text-[var(--df-accent)] hover:underline">
                        {e.fullName}
                      </Link>
                      <p className="text-xs text-[var(--df-text-muted)]">{e.jobTitle || "—"}</p>
                    </Td>
                    <Td>{e.employeeCode}</Td>
                    <Td>{e.department || "—"}</Td>
                    <Td>{e.role === "HR" ? <Badge tone="accent">HR</Badge> : <Badge tone="neutral">Employee</Badge>}</Td>
                    <Td>
                      <Badge tone={employmentStatusMeta[e.employmentStatus].tone}>{employmentStatusMeta[e.employmentStatus].label}</Badge>
                    </Td>
                    <Td>{e.profileComplete ? <Badge tone="success">Complete</Badge> : <Badge tone="warning">Incomplete</Badge>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add employee"
        description="Creates an account directly — bypasses public signup."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} loading={submitting}>
              Create
            </Button>
          </>
        }
      >
        <form onSubmit={onCreate} className="space-y-3">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div>
            <Label htmlFor="new-fullName">Full name</Label>
            <Input id="new-fullName" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-employeeCode">Employee ID</Label>
              <Input id="new-employeeCode" required value={form.employeeCode} onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label htmlFor="new-role">Role</Label>
              <Select id="new-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "EMPLOYEE" | "HR" }))}>
                <option value="EMPLOYEE">Employee</option>
                <option value="HR">HR</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-department">Department</Label>
              <Input id="new-department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="new-jobTitle">Job title</Label>
              <Input id="new-jobTitle" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="new-password">Temporary password</Label>
            <Input id="new-password" type="text" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Shared with the employee securely" />
          </div>
        </form>
      </Modal>
    </Card>
  );
}
