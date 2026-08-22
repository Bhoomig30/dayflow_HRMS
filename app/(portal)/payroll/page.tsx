import { requireSessionForPage } from "@/lib/auth/pageGuards";
import { getPublishedPayrollHistory } from "@/lib/services/payroll.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatMonth } from "@/lib/ui/format";
import { Wallet, TrendingUp, MinusCircle, PlusCircle } from "lucide-react";

export default async function PayrollPage() {
  const session = await requireSessionForPage();
  const records = await getPublishedPayrollHistory(session.employeeId);
  const latest = records[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6 df-animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--df-text-primary)]">Payroll</h1>
        <p className="mt-1 text-sm text-[var(--df-text-muted)]">
          Only published payslips appear here. Figures are stored values entered by HR — Dayflow does not compute tax, PF or HRA.
        </p>
      </div>

      {!latest ? (
        <Card>
          <CardContent className="pt-5">
            <EmptyState icon={Wallet} title="No payslip published yet" description="HR hasn't published a payroll record for you. Check back once your first payslip is available." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={`Net salary — ${formatMonth(latest.effectiveMonth)}`} value={formatCurrency(latest.netSalary, latest.currency)} icon={TrendingUp} tone="accent" />
            <StatCard label="Basic + allowances" value={formatCurrency(latest.basicSalary + latest.allowances, latest.currency)} icon={PlusCircle} />
            <StatCard label="Deductions" value={formatCurrency(latest.deductions, latest.currency)} icon={MinusCircle} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payslip history</CardTitle>
              <CardDescription>Most recent first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="rounded-[var(--df-radius-md)] border border-[var(--df-border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--df-text-primary)]">{formatMonth(r.effectiveMonth)}</p>
                    <p className="text-sm font-semibold text-[var(--df-text-primary)]">{formatCurrency(r.netSalary, r.currency)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-[var(--df-text-muted)]">
                    <span>Basic: {formatCurrency(r.basicSalary, r.currency)}</span>
                    <span>Allowances: {formatCurrency(r.allowances, r.currency)}</span>
                    <span>Deductions: {formatCurrency(r.deductions, r.currency)}</span>
                  </div>
                  {r.notes && <p className="mt-2 text-xs text-[var(--df-text-secondary)]">{r.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
