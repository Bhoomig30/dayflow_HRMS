"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { api, ClientApiError } from "@/lib/client/api";
import { formatDate } from "@/lib/ui/format";
import { leaveTypeMeta } from "@/lib/ui/status";
import { Badge } from "@/components/ui/Badge";

interface Plan {
  workingDays: number;
  calendarDays: number;
  balanceContext: { totalDays: number | null; usedDays: number; pendingDays: number; remainingDays: number | null } | null;
  overlappingTeammates: { fullName: string; leaveType: string; startDate: string; endDate: string; status: string }[];
  hasTeamData: boolean;
  note: string;
}

export function LeaveRequestForm() {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState<"PAID" | "SICK" | "UNPAID">("PAID");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setPlanLoading(true);
    const timer = setTimeout(() => {
      api
        .post<{ plan: Plan }>("/api/leave/plan", { leaveType, startDate, endDate })
        .then((res) => !cancelled && setPlan(res.plan))
        .catch(() => !cancelled && setPlan(null))
        .finally(() => !cancelled && setPlanLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [leaveType, startDate, endDate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await api.post("/api/leave", { leaveType, startDate, endDate, remarks: remarks || undefined });
      setSuccess(true);
      setStartDate("");
      setEndDate("");
      setRemarks("");
      setPlan(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">Leave request submitted.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="leaveType">Leave type</Label>
          <Select id="leaveType" value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}>
            <option value="PAID">Paid</option>
            <option value="SICK">Sick</option>
            <option value="UNPAID">Unpaid</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} />
        </div>
      </div>

      <div>
        <Label htmlFor="remarks">Remarks (optional)</Label>
        <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add context for HR…" />
      </div>

      {planLoading && <p className="text-xs text-[var(--df-text-muted)]">Calculating…</p>}

      {plan && !planLoading && (
        <div className="rounded-[var(--df-radius-md)] border border-[var(--df-accent)]/25 bg-[var(--df-accent-soft)] p-4 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--df-accent)]">
            <Info className="size-3.5" /> Smart Leave Planner
          </p>
          <p className="mt-2 text-[var(--df-text-primary)]">
            {plan.workingDays} working day{plan.workingDays === 1 ? "" : "s"} ({plan.calendarDays} calendar day{plan.calendarDays === 1 ? "" : "s"})
          </p>
          {plan.balanceContext && plan.balanceContext.remainingDays !== null && (
            <p className="mt-1 text-xs text-[var(--df-text-secondary)]">
              {plan.balanceContext.remainingDays} day(s) remaining after pending requests ({plan.balanceContext.usedDays} used, {plan.balanceContext.pendingDays} pending elsewhere).
            </p>
          )}
          {plan.hasTeamData ? (
            plan.overlappingTeammates.length > 0 ? (
              <div className="mt-2">
                <p className="flex items-center gap-1 text-xs font-medium text-[var(--df-text-primary)]">
                  <Users className="size-3.5" /> {plan.overlappingTeammates.length} teammate(s) with overlapping leave
                </p>
                <ul className="mt-1 space-y-1">
                  {plan.overlappingTeammates.map((t, i) => (
                    <li key={i} className="text-xs text-[var(--df-text-secondary)]">
                      {t.fullName} — {formatDate(t.startDate)} to {formatDate(t.endDate)}{" "}
                      <Badge tone={t.status === "APPROVED" ? "success" : "warning"} className="ml-1">
                        {t.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--df-text-secondary)]">No overlapping team leave found.</p>
            )
          ) : (
            <p className="mt-2 text-xs text-[var(--df-text-muted)]">No department set on your profile — team overlap can&apos;t be checked.</p>
          )}
          <p className="mt-2 text-[11px] text-[var(--df-text-muted)]">{plan.note}</p>
        </div>
      )}

      <Button type="submit" loading={submitting} disabled={!startDate || !endDate}>
        <Send className="size-4" /> Submit request
      </Button>
      <p className="text-[11px] text-[var(--df-text-muted)]">Type: {leaveTypeMeta[leaveType].label}</p>
    </form>
  );
}
