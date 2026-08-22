import { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Tone } from "@/lib/ui/status";

const icons: Partial<Record<Tone, typeof Info>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

export function Alert({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = icons[tone] ?? Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--df-radius-md)] border px-4 py-3 text-sm",
        tone === "success" && "border-[var(--df-success)]/30 bg-[var(--df-success-soft)] text-[var(--df-success)]",
        tone === "warning" && "border-[var(--df-warning)]/30 bg-[var(--df-warning-soft)] text-[var(--df-warning)]",
        tone === "danger" && "border-[var(--df-danger)]/30 bg-[var(--df-danger-soft)] text-[var(--df-danger)]",
        tone === "info" && "border-[var(--df-info)]/30 bg-[var(--df-info-soft)] text-[var(--df-info)]",
        className
      )}
      role="alert"
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-[var(--df-text-primary)]">{children}</div>
    </div>
  );
}
