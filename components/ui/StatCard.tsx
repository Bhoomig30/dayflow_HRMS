import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "accent";
  className?: string;
}

export function StatCard({ label, value, icon: Icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--df-radius-lg)] border border-[var(--df-border)] bg-[var(--df-surface)] p-5 transition-colors hover:bg-[var(--df-surface-hover)]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--df-text-muted)]">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              tone === "accent" ? "bg-[var(--df-accent-soft)] text-[var(--df-accent)]" : "bg-white/5 text-[var(--df-text-secondary)]"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--df-text-primary)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--df-text-muted)]">{hint}</p>}
    </div>
  );
}
