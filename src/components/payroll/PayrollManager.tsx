"use client";

import { useState } from "react";
import { Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApi } from "@/lib/client/useApi";
import { api, ClientApiError } from "@/lib/client/api";
import { formatCurrency, formatMonth } from "@/lib/ui/format";
import { payrollStatusMeta } from "@/lib/ui/status";

interface PayrollRow {
  id: string;
  effectiveMonth: string;
  currency: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "DRAFT" | "PUBLISHED";
}

export function PayrollManager({ employeeId }: { employeeId: string }) {
  const { data, error, loading, refetch } = useApi<{ records: PayrollRow[] }>(`/api/employees/${employeeId}/payroll`);
  const [form, setForm] = useState({ effectiveMonth: "", basicSalary: "", allowances: "0", deductions: "0", currency: "INR" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/employees/${employeeId}/payroll`, {
        effectiveMonth: form.effectiveMonth,
        basicSalary: Number(form.basicSalary),
        allowances: Number(form.allowances || 0),
        deductions: Number(form.deductions || 0),
        currency: form.currency,
      });
      setForm((f) => ({ ...f, effectiveMonth: "", basicSalary: "", allowances: "0", deductions: "0" }));
      refetch();
    } catch (err) {
      setFormError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function publish(id: string) {
    setPublishingId(id);
    try {
      await api.post(`/api/payroll/${id}/publish`);
      refetch();
    } catch (err) {
      setFormError(err instanceof ClientApiError ? err.message : "Could not publish.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="grid grid-cols-2 gap-3 rounded-[var(--df-radius-md)] border border-[var(--df-border)] p-4 sm:grid-cols-5">
        {formError && (
          <div className="col-span-2 sm:col-span-5">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <div>
          <Label htmlFor="effectiveMonth">Month</Label>
          <Input id="effectiveMonth" type="month" required value={form.effectiveMonth} onChange={(e) => setForm((f) => ({ ...f, effectiveMonth: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="basicSalary">Basic</Label>
          <Input id="basicSalary" type="number" min={0} required value={form.basicSalary} onChange={(e) => setForm((f) => ({ ...f, basicSalary: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="allowances">Allowances</Label>
          <Input id="allowances" type="number" min={0} value={form.allowances} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="deductions">Deductions</Label>
          <Input id="deductions" type="number" min={0} value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" loading={submitting}>
            <Send className="size-3.5" /> Save draft
          </Button>
        </div>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <p className="text-xs text-[var(--df-text-muted)]">Loading…</p>}
      {!loading && data && data.records.length === 0 && <EmptyState title="No payroll records" />}
      {data && data.records.length > 0 && (
        <ul className="space-y-2">
          {data.records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--df-radius-md)] border border-[var(--df-border)] px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-[var(--df-text-primary)]">{formatMonth(r.effectiveMonth)}</p>
                <p className="text-xs text-[var(--df-text-muted)]">
                  Net {formatCurrency(r.netSalary, r.currency)} (Basic {formatCurrency(r.basicSalary, r.currency)} + Allowances{" "}
                  {formatCurrency(r.allowances, r.currency)} − Deductions {formatCurrency(r.deductions, r.currency)})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={payrollStatusMeta[r.status].tone}>{payrollStatusMeta[r.status].label}</Badge>
                {r.status === "DRAFT" && (
                  <Button size="sm" variant="secondary" onClick={() => publish(r.id)} loading={publishingId === r.id}>
                    <Upload className="size-3.5" /> Publish
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // scripts/ holds standalone Node dev-tooling (seeding, visual QA
    // screenshots) that isn't part of the shipped Next.js app and isn't run
    // through its module system — plain CommonJS is appropriate there, not
    // an app-wide lint exemption.
    "scripts/**",
  ]),
]);

export default eslintConfig;
