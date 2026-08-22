"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Table, TableContainer, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { useApi } from "@/lib/client/useApi";
import { api, ClientApiError } from "@/lib/client/api";
import { formatDate } from "@/lib/ui/format";
import { leaveStatusMeta, leaveTypeMeta } from "@/lib/ui/status";
import type { LeaveStatus } from "@/lib/db/schema";

interface LeaveRow {
  id: string;
  employeeName: string;
  leaveType: "PAID" | "SICK" | "UNPAID";
  startDate: string;
  endDate: string;
  workingDays: number;
  status: LeaveStatus;
  remarks: string | null;
  hrComment: string | null;
}

const tabs: { key: LeaveStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export function LeaveReviewPanel() {
  const [tab, setTab] = useState<LeaveStatus | "ALL">("PENDING");
  const url = tab === "ALL" ? "/api/leave/all" : `/api/leave/all?status=${tab}`;
  const { data, error, loading, refetch } = useApi<{ requests: LeaveRow[] }>(url, [tab]);
  const [actionTarget, setActionTarget] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function submitAction() {
    if (!actionTarget) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/leave/${actionTarget.id}/${actionTarget.action}`, { comment: comment || undefined });
      setActionTarget(null);
      setComment("");
      refetch();
    } catch (err) {
      setActionError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-1 rounded-[var(--df-radius-md)] bg-[var(--df-bg-elevated)] p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-[var(--df-radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? "bg-[var(--df-accent)] text-[#0a1123]" : "text-[var(--df-text-secondary)] hover:text-[var(--df-text-primary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {loading && <p className="text-xs text-[var(--df-text-muted)]">Loading…</p>}

        {!loading && data && data.requests.length === 0 && <EmptyState title="Nothing here" description="No leave requests match this filter." />}

        {!loading && data && data.requests.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>Dates</Th>
                  <Th>Days</Th>
                  <Th>Status</Th>
                  {tab === "PENDING" && <Th>Actions</Th>}
                </Tr>
              </Thead>
              <tbody>
                {data.requests.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.employeeName}</Td>
                    <Td>{leaveTypeMeta[r.leaveType].label}</Td>
                    <Td>
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </Td>
                    <Td>{r.workingDays}</Td>
                    <Td>
                      <Badge tone={leaveStatusMeta[r.status].tone}>{leaveStatusMeta[r.status].label}</Badge>
                    </Td>
                    {tab === "PENDING" && (
                      <Td>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setActionTarget({ id: r.id, action: "approve" })}>
                            <Check className="size-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setActionTarget({ id: r.id, action: "reject" })}>
                            <X className="size-3.5" /> Reject
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      <Modal
        open={Boolean(actionTarget)}
        onClose={() => {
          setActionTarget(null);
          setComment("");
          setActionError(null);
        }}
        title={actionTarget?.action === "approve" ? "Approve leave request" : "Reject leave request"}
        description="This updates attendance and notifies the employee immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setActionTarget(null)}>
              Cancel
            </Button>
            <Button variant={actionTarget?.action === "approve" ? "primary" : "danger"} onClick={submitAction} loading={submitting}>
              Confirm {actionTarget?.action}
            </Button>
          </>
        }
      >
        {actionError && <Alert tone="danger" className="mb-3">{actionError}</Alert>}
        <Textarea placeholder="Add a comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </Card>
  );
}
