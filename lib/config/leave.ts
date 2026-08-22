/**
 * Leave policy defaults.
 *
 * The Dayflow requirements explicitly forbid inventing company leave
 * policy. No leave-accrual policy was supplied, so — rather than silently
 * making one up and presenting it as real — these are exposed as
 * environment-configurable defaults, clearly labeled "default allotment"
 * everywhere they appear in the UI, and documented in the README as a
 * placeholder a real deployment MUST review and set deliberately.
 *
 * UNPAID leave has no balance/cap by definition, so it is intentionally
 * excluded here.
 */
export const DEFAULT_PAID_LEAVE_DAYS = Number(process.env.DAYFLOW_DEFAULT_PAID_LEAVE_DAYS ?? 18);
export const DEFAULT_SICK_LEAVE_DAYS = Number(process.env.DAYFLOW_DEFAULT_SICK_LEAVE_DAYS ?? 10);

export const BALANCED_LEAVE_TYPES = ["PAID", "SICK"] as const;
