import { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A plain table wrapped in a horizontally-scrolling container, so it stays
 * fully usable (every column reachable, nothing clipped) on narrow screens
 * instead of being invisibly squeezed. Pages with especially data-dense
 * tables additionally provide a stacked card view below the `md` breakpoint
 * (see e.g. hr/employees) — this component is the shared baseline.
 */
export function TableContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-x-auto rounded-[var(--df-radius-lg)] border border-[var(--df-border)]", className)}>{children}</div>;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full min-w-[640px] border-collapse text-sm", className)} {...props} />;
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[var(--df-bg-elevated)]", className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--df-text-muted)]", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-[var(--df-border)] transition-colors hover:bg-white/[0.02]", className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle text-[var(--df-text-primary)]", className)} {...props} />;
}
