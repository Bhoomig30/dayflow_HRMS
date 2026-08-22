import { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-[var(--df-radius-lg)] px-6 py-12 text-center", className)}>
      <div className="flex size-11 items-center justify-center rounded-full bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--df-text-primary)]">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--df-text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
