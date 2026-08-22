"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApi } from "@/lib/client/useApi";
import { api, ClientApiError } from "@/lib/client/api";

interface Department {
  id: string;
  name: string;
  employeeCount: number;
}

export function DepartmentsPanel() {
  const { data, error, loading, refetch } = useApi<{ departments: Department[] }>("/api/departments");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post("/api/departments", { name });
      setName("");
      refetch();
    } catch (err) {
      setFormError(err instanceof ClientApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onCreate} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" required />
          <Button type="submit" loading={submitting}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
        {formError && <Alert tone="danger">{formError}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        {loading && <p className="text-xs text-[var(--df-text-muted)]">Loading…</p>}
        {!loading && data && data.departments.length === 0 && <EmptyState icon={Building2} title="No departments yet" description="Add one above to start assigning employees." />}
        {data && data.departments.length > 0 && (
          <ul className="divide-y divide-[var(--df-border)] rounded-[var(--df-radius-md)] border border-[var(--df-border)]">
            {data.departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-[var(--df-text-primary)]">{d.name}</span>
                <span className="text-xs text-[var(--df-text-muted)]">
                  {d.employeeCount} employee{d.employeeCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
