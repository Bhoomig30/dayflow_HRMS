/**
 * Central status → { label, tone } mapping so every badge in the app (leave
 * status, attendance status, anomaly severity, payroll status) looks and
 * reads the same way instead of five ad-hoc implementations.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export const toneClasses: Record<Tone, string> = {
  success: "bg-[var(--df-success-soft)] text-[var(--df-success)] border-[var(--df-success)]/30",
  warning: "bg-[var(--df-warning-soft)] text-[var(--df-warning)] border-[var(--df-warning)]/30",
  danger: "bg-[var(--df-danger-soft)] text-[var(--df-danger)] border-[var(--df-danger)]/30",
  info: "bg-[var(--df-info-soft)] text-[var(--df-info)] border-[var(--df-info)]/30",
  accent: "bg-[var(--df-accent-soft)] text-[var(--df-accent)] border-[var(--df-accent)]/30",
  neutral: "bg-white/5 text-[var(--df-text-secondary)] border-[var(--df-border-strong)]",
};

export const attendanceStatusMeta: Record<string, { label: string; tone: Tone }> = {
  PRESENT: { label: "Present", tone: "success" },
  ABSENT: { label: "Absent", tone: "danger" },
  HALF_DAY: { label: "Half-day", tone: "warning" },
  LEAVE: { label: "Leave", tone: "info" },
};

export const leaveStatusMeta: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const leaveTypeMeta: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: "Paid leave", tone: "accent" },
  SICK: { label: "Sick leave", tone: "info" },
  UNPAID: { label: "Unpaid leave", tone: "neutral" },
};

export const severityMeta: Record<string, { label: string; tone: Tone }> = {
  HIGH: { label: "High", tone: "danger" },
  MEDIUM: { label: "Medium", tone: "warning" },
  LOW: { label: "Low", tone: "info" },
};

export const payrollStatusMeta: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "success" },
};

export const employmentStatusMeta: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};
